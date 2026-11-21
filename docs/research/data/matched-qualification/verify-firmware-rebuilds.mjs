import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

// Compare actual ARM load segments and memory layout. Debug sections do not run.
export function armImage(bytes){
 if(bytes.length<52||bytes.toString('hex',0,4)!=='7f454c46'||bytes[4]!==1||bytes[5]!==1||bytes.readUInt16LE(16)!==2||bytes.readUInt16LE(18)!==40)throw Error('Expected little-endian ELF32 ARM executable');
 const entry=bytes.readUInt32LE(24),abiFlags=bytes.readUInt32LE(36),offset=bytes.readUInt32LE(28),stride=bytes.readUInt16LE(42),count=bytes.readUInt16LE(44);
 if(stride!==32||!count||offset+count*stride>bytes.length)throw Error('Invalid ELF program table');
 const segments=[];
 for(let i=0;i<count;i++){
  const p=offset+i*stride;if(bytes.readUInt32LE(p)!==1)continue;
  const o=bytes.readUInt32LE(p+4),size=bytes.readUInt32LE(p+16),memory=bytes.readUInt32LE(p+20);
  if(o+size>bytes.length||size>memory)throw Error('Invalid load segment');
  segments.push({virtualAddress:bytes.readUInt32LE(p+8),physicalAddress:bytes.readUInt32LE(p+12),fileBytes:size,memoryBytes:memory,flags:bytes.readUInt32LE(p+24),alignment:bytes.readUInt32LE(p+28),sha256:hash(bytes.subarray(o,o+size))});
 }
 if(!segments.length)throw Error('No loadable segments');
 return {entry,abiFlags,segments,imageSha256:hash(JSON.stringify({entry,abiFlags,segments}))};
}

if(process.argv[1]?.endsWith('/verify-firmware-rebuilds.mjs')){
 const root='qa/qualification-work/rebuilds';
 const paths={cognipilot:'arm-source-rebuild-env/cerebri_rdd2/zephyr/zephyr.elf',betaflight:'betaflight-rebuilt.elf'};
 const checks=[];
 for(const [stack,p] of Object.entries(paths)){
  if(!fs.existsSync(root+'/'+p))continue;
  const frozen=fs.readFileSync(root+'/source/'+stack+'.elf'),rebuilt=fs.readFileSync(root+'/'+p),a=armImage(frozen),b=armImage(rebuilt);
  checks.push({stack,frozenElfSha256:hash(frozen),rebuiltElfSha256:hash(rebuilt),fullFileIdentical:hash(frozen)===hash(rebuilt),loadImageIdentical:a.imageSha256===b.imageSha256,frozen:a,rebuilt:b});
 }
 const report={analyzerSha256:hash(fs.readFileSync(new URL(import.meta.url))),scope:'ELF entry point, ARM ABI flags, load-segment bytes, addresses, zero-initialized memory sizes, permissions and alignment. Debug/symbol-only changes are excluded. Does not establish physical board readiness.',checks};
 fs.writeFileSync('qa/qualification-work/firmware-rebuild-checks.json',JSON.stringify(report,null,2)+'\n');
 console.log(checks.map(({stack,loadImageIdentical,fullFileIdentical})=>({stack,loadImageIdentical,fullFileIdentical})));
 if(checks.some(c=>!c.loadImageIdentical))process.exitCode=1;
}
