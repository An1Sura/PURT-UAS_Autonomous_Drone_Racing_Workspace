#include <assert.h>
#include <dlfcn.h>
#include <stdint.h>
#include <stdio.h>

typedef void *(*init_fn)(void *);
typedef uint64_t (*read_fn)(void *, uint64_t, unsigned);
typedef void (*write_fn)(void *, uint64_t, uint64_t, unsigned);

int main(int argc, char **argv)
{
    assert(argc == 3);
    void *b = dlopen(argv[1], RTLD_LAZY), *s = dlopen(argv[2], RTLD_LAZY);
    if (!b || !s) { fprintf(stderr, "%s\n", dlerror()); return 1; }
    init_fn bi = (init_fn)dlsym(b, "stm32f405_boot_init");
    read_fn br = (read_fn)dlsym(b, "stm32f405_boot_read");
    write_fn bw = (write_fn)dlsym(b, "stm32f405_boot_write");
    init_fn si = (init_fn)dlsym(s, "stm32f405_spi_init");
    read_fn sr = (read_fn)dlsym(s, "stm32f405_spi_read");
    write_fn sw = (write_fn)dlsym(s, "stm32f405_spi_write");
    assert(bi && br && bw && si && sr && sw);
    void *bs=bi(0), *ss=si(0);
    bw(bs, 0x40023800, (1u<<24)|(1u<<16)|1, 4);
    assert((br(bs,0x40023800,4)&0x03030003)==0x03030003);
    bw(bs, 0x40023800, 0, 4);
    assert((br(bs,0x40023800,4)&0x03030003)==0);
    bw(bs,0x40023808,2,4);
    assert((br(bs,0x40023808,4)&15)==10);
    bw(bs,0x40023830,1u<<20,4);
    assert((br(bs,0x40023874,4)&(1u<<28))==0);
    bw(bs,0x40002850,0x42656631,4);
    bw(bs,0x40023830,1u<<20,4);
    assert(br(bs,0x40002850,4)==0x42656631);
    assert(br(bs,0x40023874,4)&(1u<<28));
    bw(bs,0x40002854,0x12345678,4);
    bw(bs,0x40002855,0xab,1);
    assert(br(bs,0x40002854,4)==0x1234ab78);
    assert(br(bs,0x40002855,1)==0xab);
    bw(bs,0x40012008,1u<<22,4);
    assert(br(bs,0x40012000,4)&4);
    assert(!(br(bs,0x40012008,4)&(1u<<22)));
    bw(bs,0x40012000,~4u,4);
    assert(!(br(bs,0x40012000,4)&4));
    assert(br(bs,0x4001203c,4)==1500);
    assert(sr(ss,0x40013008,2)==2);
    sw(ss,0x40020018,1u<<20,4); /* assert MPU CS */
    sw(ss,0x4001300c,0xf5,2); /* read WHO_AM_I */
    assert(sr(ss,0x40013008,2)==3);
    (void)sr(ss,0x4001300c,2);
    assert(sr(ss,0x40013008,2)==2);
    sw(ss,0x4001300c,0xff,2);
    assert(sr(ss,0x4001300c,2)==0x68);
    sw(ss,0x40020018,1u<<4,4);
    sw(ss,0x40020018,1u<<20,4);
    sw(ss,0x4001300c,0x8c,2);
    (void)sr(ss,0x4001300c,2);
    sw(ss,0x4001300c,0xff,2);
    assert(sr(ss,0x4001300c,2)==0x58);
    sw(ss,0x40020018,1u<<4,4);
    sw(ss,0x4001300c,0xff,2);
    assert(sr(ss,0x4001300c,2)==0xff);
    sw(ss,0x4002001a,1u<<4,2); /* actual firmware halfword CS reset */
    sw(ss,0x4001300c,0xf5,2);
    (void)sr(ss,0x4001300c,2);
    sw(ss,0x4001300c,0xff,2);
    assert(sr(ss,0x4001300c,2)==0x68);
    sw(ss,0x40020018,1u<<4,2);
    puts("PASS: boot register and polled SPI identity behavior; not a flight or timing test");
    return 0;
}
