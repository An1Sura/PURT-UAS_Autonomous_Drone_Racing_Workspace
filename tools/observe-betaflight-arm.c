/* Read-only observer for c9530644... Betaflight TROPIC ELF.
 * Addresses: arm-none-eabi-nm -S. Layouts: fastdyn_adr.c, pid.h, gyro.h.
 * Observational, irregular samples. Never use wall-clock sampling as hardware
 * latency evidence. Does not pause QEMU or write guest memory.
 */
#define _POSIX_C_SOURCE 200809L
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <time.h>
#include <sys/stat.h>
#if __BYTE_ORDER__ != __ORDER_LITTLE_ENDIAN__
#error This pinned ABI observer requires a little-endian host
#endif

static uint32_t u32(const unsigned char *p) { uint32_t v; memcpy(&v,p,4); return v; }
static uint64_t u64(const unsigned char *p) { uint64_t v; memcpy(&v,p,8); return v; }
static float f32(const unsigned char *p) { float v; memcpy(&v,p,4); return v; }
static int read_at(int fd,void *buf,size_t n,off_t offset) { return pread(fd,buf,n,offset)==(ssize_t)n; }
static double now(void) { struct timespec t; clock_gettime(CLOCK_MONOTONIC,&t); return t.tv_sec+t.tv_nsec/1e9; }

int main(int argc,char **argv)
{
    if(argc!=3) { fprintf(stderr,"Usage: observer DTCM_FILE FINAL_SEQUENCE\n"); return 2; }
    char *end; unsigned long stop=strtoul(argv[2],&end,10);
    if(!stop || *end || stop>UINT32_MAX) return 2;
    int fd=-1; uint32_t last=0; unsigned long accepted=0,rejected=0;
    double deadline=now()+3600;
    struct timespec pause={.tv_sec=0,.tv_nsec=1000000};
    puts("sequence,sim_time_s,gyro_yaw_deg_s,rc_yaw_setpoint_deg_s,yaw_P,yaw_I,yaw_D,yaw_F,yaw_S,yaw_sum,m0,m1,m2,m3,attitude_yaw_deg");
    while(now()<deadline) {
        nanosleep(&pause,NULL);
        if(fd<0) {
            fd=open(argv[1],O_RDONLY);
            if(fd<0) { if(errno==ENOENT) continue; perror("open"); return 1; }
            struct stat s;
            if(fstat(fd,&s) || s.st_size!=256*1024) { fprintf(stderr,"Unexpected DTCM size\n"); close(fd); return 1; }
        }
        unsigned char shared[280],pid[72],gyro[40],setpoint[12],after[16];
        if(!read_at(fd,shared,sizeof(shared),0x1cd00)) { rejected++; continue; }
        uint32_t request=u32(shared+8),response=u32(shared+12),stage=u32(shared+4);
        if(stage==4 && last) break;
        if(stage!=3 || !response || response!=request || response==last) { rejected++; continue; }
        if(!read_at(fd,pid,sizeof(pid),0x249d4) ||
           !read_at(fd,gyro,sizeof(gyro),0x24f14) ||
           !read_at(fd,setpoint,sizeof(setpoint),0xe7d4) ||
           !read_at(fd,after,sizeof(after),0x1cd00)) { rejected++; continue; }
        /* Accept only a completed, unchanged request/response handshake on
           both sides of the read. In-flight or torn snapshots are discarded. */
        if(u32(after+4)!=3 || u32(after+8)!=request || u32(after+12)!=response ||
           u32(shared+216)!=1 || u32(shared+220)!=response ||
           u64(shared+264)!=(uint64_t)response*125) { rejected++; continue; }
        const unsigned char *yaw=pid+48,*out=shared+216;
        printf("%u,%.6f,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g,%.9g\n",
               response,u64(shared+264)/1e6,f32(gyro+36),f32(setpoint+8),
               f32(yaw),f32(yaw+4),f32(yaw+8),f32(yaw+12),f32(yaw+16),f32(yaw+20),
               f32(out+8),f32(out+12),f32(out+16),f32(out+20),f32(out+44));
        last=response; accepted++;
        if(accepted%100==0) fflush(stdout);
        if(response>=stop) break;
    }
    if(fd>=0) close(fd);
    fprintf(stderr,"accepted=%lu rejected_or_duplicate=%lu final_sequence=%u\n",accepted,rejected,last);
    return last>=stop ? 0 : 1;
}
