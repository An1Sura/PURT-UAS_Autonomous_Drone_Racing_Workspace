/* PX4 startup subset of RT1064 SNVS: enable, 32768 Hz counters and LP->HP sync.
 * Derived from NuttX imxrt_snvs.h/imxrt_hprtc.c. No alarms, tamper or physical timing.
 * Separate from the existing CogniPilot/Betaflight peripheral model.
 */
#include <stdint.h>
#include <stdlib.h>
#include <device.h>
#include <qemu/qemu-plugin.h>

typedef struct {
    uint32_t registers[0xc00 / 4];
    uint64_t ticks[2];
    uint64_t epoch_ns[2];
    uint64_t remainder[2];
} Snvs;

static void advance(Snvs *s, unsigned bank, uint64_t now)
{
    unsigned control = bank ? 0x38 : 0x08;
    if (s->registers[control / 4] & 1) {
        uint64_t elapsed = now - s->epoch_ns[bank];
        uint64_t fraction = (elapsed % 1000000000ULL) * 32768ULL + s->remainder[bank];
        s->ticks[bank] += (elapsed / 1000000000ULL) * 32768ULL + fraction / 1000000000ULL;
        s->remainder[bank] = fraction % 1000000000ULL;
        s->epoch_ns[bank] = now;
    } else {
        s->epoch_ns[bank] = now;
    }
}

void *snvs_init(ConfigSection *model_info)
{
    (void)model_info;
    Snvs *s = calloc(1, sizeof(*s));
    if (s) s->epoch_ns[0] = s->epoch_ns[1] = qemu_plugin_get_virtual_timer();
    return s;
}

uint64_t snvs_read(void *opaque, uint64_t addr, unsigned size)
{
    Snvs *s = opaque;
    if (!s || size != 4 || addr < 0x400d4000 || addr >= 0x400d4c00 || (addr & 3)) return 0;
    unsigned offset = addr - 0x400d4000;
    uint64_t now = qemu_plugin_get_virtual_timer();
    advance(s, 0, now); advance(s, 1, now);
    if (offset == 0x24) return (s->ticks[0] >> 32) & 0x7fff;
    if (offset == 0x28) return (uint32_t)s->ticks[0];
    if (offset == 0x50) return (s->ticks[1] >> 32) & 0x7fff;
    if (offset == 0x54) return (uint32_t)s->ticks[1];
    return s->registers[offset / 4];
}

void snvs_write(void *opaque, uint64_t addr, uint64_t value, unsigned size)
{
    Snvs *s = opaque;
    if (!s || size != 4 || addr < 0x400d4000 || addr >= 0x400d4c00 || (addr & 3)) return;
    unsigned offset = addr - 0x400d4000;
    uint64_t now = qemu_plugin_get_virtual_timer();
    advance(s, 0, now); advance(s, 1, now);
    if (offset == 0x14 || offset == 0x4c) { s->registers[offset / 4] &= ~(uint32_t)value; return; }
    if (offset == 0x24 || offset == 0x50) {
        unsigned bank = offset == 0x50;
        s->ticks[bank] = (s->ticks[bank] & 0xffffffffULL) | ((value & 0x7fffULL) << 32);
        s->epoch_ns[bank] = now; s->remainder[bank] = 0;
    } else if (offset == 0x28 || offset == 0x54) {
        unsigned bank = offset == 0x54;
        s->ticks[bank] = (s->ticks[bank] & 0x7fff00000000ULL) | (uint32_t)value;
        s->epoch_ns[bank] = now;
    }
    if (offset == 0x08 && (value & (1U << 16))) { s->ticks[0] = s->ticks[1]; s->epoch_ns[0] = now; s->remainder[0] = s->remainder[1]; value &= ~(1U << 16); }
    if (offset == 0x08 || offset == 0x38) s->epoch_ns[offset == 0x38] = now;
    s->registers[offset / 4] = value;
}
