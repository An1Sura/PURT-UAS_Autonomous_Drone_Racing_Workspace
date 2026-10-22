/* Boot-only STM32F405 register model for FastDyn. Not a timing oracle.
 * Clock-ready transitions are immediate. RTC backup words survive guest reset.
 * Software reset is inferred from the firmware's repeated CCM enable at Reset_Handler;
 * this does not model all STM32 reset causes or backup-domain protection.
 */
#include <stdint.h>
#include <string.h>
#include <device.h>

static uint32_t rcc[0x100/4], rtc[0x100/4], pwr[8], flash[8];
static unsigned boot_sequences;

static uint32_t *word(uint64_t a)
{
    if (a >= 0x40023800 && a < 0x40023900) return &rcc[(a-0x40023800)/4];
    if (a >= 0x40002800 && a < 0x40002900) return &rtc[(a-0x40002800)/4];
    if (a >= 0x40007000 && a < 0x40007020) return &pwr[(a-0x40007000)/4];
    if (a >= 0x40023c00 && a < 0x40023c20) return &flash[(a-0x40023c00)/4];
    return 0;
}

void *stm32f405_boot_init(ConfigSection *config)
{
    (void)config;
    memset(rcc, 0, sizeof(rcc)); memset(rtc, 0, sizeof(rtc));
    memset(pwr, 0, sizeof(pwr)); memset(flash, 0, sizeof(flash));
    rcc[0] = 0x83; rcc[1] = 0x24003010;
    boot_sequences = 0;
    return rcc;
}

uint64_t stm32f405_boot_read(void *state, uint64_t addr, unsigned size)
{
    (void)state;
    uint32_t *p = word(addr), v = p ? *p : 0;
    unsigned shift = (addr & 3) * 8;
    return size >= 4 ? v : (v >> shift) & ((1u << (size*8))-1);
}

void stm32f405_boot_write(void *state, uint64_t addr, uint64_t value, unsigned size)
{
    (void)state;
    uint32_t *p = word(addr);
    if (!p) return;
    unsigned shift = (addr & 3) * 8;
    uint32_t mask = size >= 4 ? UINT32_MAX : ((1u << (size*8))-1) << shift;
    uint32_t v = (*p & ~mask) | (((uint32_t)value << shift) & mask);
    if (addr == 0x40023800) {
        /* HSIRDY, HSERDY, PLLRDY follow their enable bits. */
        const uint32_t enables = (1u<<0)|(1u<<16)|(1u<<24)|(1u<<26);
        v = (v & ~(enables << 1)) | ((v & enables) << 1);
    }
    if (addr == 0x40023830 && (v & (1u<<20))) {
        if (++boot_sequences > 1) rcc[0x74/4] |= 1u<<28;
    }
    if (addr == 0x40023808) {
        v = (v & ~12u) | ((v & 3u) << 2);
    }
    if (addr == 0x40023874 && (v & (1u<<24))) v &= 0x00ffffffu;
    if (addr == 0x40023c0c) v = *p & ~v; /* FLASH status W1C */
    *p = v;
}
