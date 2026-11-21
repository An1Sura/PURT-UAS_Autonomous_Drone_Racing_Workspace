//! ARM firmware transport for the existing Betaflight benchmark packet ABI.
//! The firmware uses simulated I/O; this is not a peripheral latency benchmark.
use anyhow::{Context, Result, ensure};
use memmap2::{MmapMut, MmapOptions};
use object::{Object, ObjectSymbol};
use std::{fs, path::Path, ptr, sync::atomic::{AtomicU32, Ordering}, thread, time::{Duration, Instant}};

pub struct ArmTransport { memory: MmapMut, offset: usize }
impl ArmTransport {
    fn word(&self, off: usize) -> &AtomicU32 {
        // ELF symbol is aligned to 64 bytes; all protocol words are aligned.
        unsafe { &*(self.memory.as_ptr().add(self.offset+off) as *const AtomicU32) }
    }
    fn read(&self, off: usize, count: usize) -> Vec<u8> {
        (0..count).map(|i| unsafe { ptr::read_volatile(self.memory.as_ptr().add(self.offset+off+i)) }).collect()
    }
    fn write(&self, off: usize, bytes: &[u8]) {
        for (i,b) in bytes.iter().enumerate() {
            unsafe { ptr::write_volatile(self.memory.as_ptr().add(self.offset+off+i) as *mut u8,*b); }
        }
    }
    fn wait(&self, off: usize, value: u32) -> Result<()> {
        let end=Instant::now()+Duration::from_secs(60);
        while self.word(off).load(Ordering::Acquire)!=value {
            let stage=self.word(4).load(Ordering::Acquire);
            ensure!(stage<250,"ARM firmware rejected input/config (stage {stage}): {}",String::from_utf8_lossy(&self.read(4376,512)).trim_end_matches(char::from(0)));
            ensure!(Instant::now()<end,"ARM handshake timeout: stage {stage}, request {}, response {}",self.word(8).load(Ordering::Acquire),self.word(12).load(Ordering::Acquire));
            thread::yield_now();
        }
        Ok(())
    }
    pub fn open(memory: &Path, binary: &Path, config: &str) -> Result<Self> {
        let bytes=fs::read(binary)?; let elf=object::File::parse(bytes.as_slice())?;
        let symbol=elf.symbol_by_name("adr_fastdyn_shared").context("missing ARM benchmark transport symbol")?;
        let offset=symbol.address().checked_sub(0x20000000).context("mailbox must be in SRAM")? as usize;
        ensure!(offset%64==0 && offset.checked_add(4888).is_some(),"invalid SRAM mailbox layout");
        let required_len = offset + 4888;
        let deadline=Instant::now()+Duration::from_secs(60);
        let file=loop {
            if let Ok(file)=fs::OpenOptions::new().read(true).write(true).open(memory) {
                if file.metadata()?.len() >= required_len as u64 { break file; }
            }
            ensure!(Instant::now()<deadline,"QEMU SRAM file not ready");
            thread::sleep(Duration::from_millis(2));
        };
        let memory=unsafe { MmapOptions::new().map_mut(&file)? };
        let this=Self{memory,offset};
        this.wait(0,0x42464431)?; this.wait(4,1)?;
        ensure!(config.len()<4096 && !config.as_bytes().contains(&0),"config exceeds ARM mailbox");
        // Stock clock setup may perform a software reset after configuration.
        // Re-provision the fresh mailbox after that reset, before any flight tick.
        let deadline=Instant::now()+Duration::from_secs(60);
        let mut provisions=0;
        loop {
            let stage=this.word(4).load(Ordering::Acquire);
            if stage==3 { break; }
            ensure!(stage<250,"ARM configuration failed: {}",String::from_utf8_lossy(&this.read(4376,512)).trim_end_matches(char::from(0)));
            ensure!(Instant::now()<deadline && provisions<5,"ARM startup reset loop or timeout (stage {stage})");
            if stage==1 {
                this.write(280,config.as_bytes()); this.write(280+config.len(),&[0]);
                this.word(4).store(2,Ordering::Release); provisions+=1;
            }
            thread::sleep(Duration::from_millis(1));
        }
        Ok(this)
    }
    pub fn replay_diagnostics(&self) -> [f32; 6] {
        let bytes=self.read(4376,24);
        std::array::from_fn(|i|f32::from_le_bytes(bytes[i*4..i*4+4].try_into().unwrap()))
    }
    pub fn replay_collective(&self) -> f32 { let b=self.read(4400,4); f32::from_le_bytes(b.try_into().unwrap()) }
    pub fn sensor_counters(&self) -> [u32; 3] {
        std::array::from_fn(|i| self.word(20 + 4*i).load(Ordering::Acquire))
    }
    pub fn exchange(&self, input: &[u8], tick: u32) -> Result<Vec<u8>> {
        ensure!(input.len()==184,"invalid ARM input packet size");
        self.write(32,input); self.word(8).store(tick,Ordering::Release);
        self.wait(12,tick)?; Ok(self.read(216,64))
    }
}
impl Drop for ArmTransport {
    fn drop(&mut self) { self.word(16).store(1,Ordering::Release); }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    #[test]
    fn exchange_preserves_packet_and_waits_for_matching_response() {
        let t=Arc::new(ArmTransport{memory:MmapMut::map_anon(128*1024).unwrap(),offset:64});
        t.word(4).store(3,Ordering::Release);
        let device=t.clone();
        let worker=thread::spawn(move || {
            device.wait(8,7).unwrap();
            assert_eq!(device.read(32,184),vec![42;184]);
            let mut out=vec![0;64];out[4..8].copy_from_slice(&7u32.to_le_bytes());
            device.write(216,&out);device.word(12).store(7,Ordering::Release);
        });
        let out=t.exchange(&[42;184],7).unwrap();
        assert_eq!(&out[4..8],&7u32.to_le_bytes());worker.join().unwrap();
    }
    #[test]
    fn malformed_packet_and_firmware_error_fail_closed() {
        let t=ArmTransport{memory:MmapMut::map_anon(128*1024).unwrap(),offset:0};
        assert!(t.exchange(&[0;183],1).is_err());
        t.word(4).store(253,Ordering::Release);t.write(4376,b"bad sequence");
        assert!(t.exchange(&[0;184],1).unwrap_err().to_string().contains("bad sequence"));
    }
}
