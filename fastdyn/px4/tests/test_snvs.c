#include <assert.h>
#include <stdint.h>
#include <stdlib.h>
static int64_t now;
int64_t qemu_plugin_get_virtual_timer(void) { return now; }
#include "../snvs_px4.c"
int main(void) {
    void *s = snvs_init(NULL);
    assert(s);
    snvs_write(s, 0x400d4038, 1, 4);
    for (now = 1; now <= 1000000000; now += 1000) snvs_read(s, 0x400d4054, 4);
    now = 1000000000;
    assert(snvs_read(s, 0x400d4054, 4) == 32768);
    snvs_write(s, 0x400d4008, 0x10001, 4);
    assert(snvs_read(s, 0x400d4028, 4) == 32768);
    now = 2000000000;
    assert(snvs_read(s, 0x400d4028, 4) == 65536);
    snvs_write(s, 0x400d4008, 0, 4);
    now = 3000000000;
    assert(snvs_read(s, 0x400d4028, 4) == 65536);
    assert(snvs_read(s, 0x400d4054, 4) == 98304);
    assert(snvs_read(s, 0, 4) == 0);
    snvs_write(s, 0x400d4c00, 0xffffffff, 4);
    free(s);
}
