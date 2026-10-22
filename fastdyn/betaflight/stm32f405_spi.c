/* Boot fixture only: polled SPI1 MPU6000 identification. No plant samples,
 * DMA, sensor interrupts, motor outputs or latency fidelity are implemented.
 * SPI2/3 return 0xff (no device). Never use this fixture for flight results.
 */
#include <stdint.h>
#include <string.h>
#include <device.h>

static uint32_t gpio[3][0x400/4], spi[3][16];
static uint8_t imu[128], address, command, selected, first;
static const uint32_t bases[3] = {0x40013000, 0x40003800, 0x40003c00};

void *stm32f405_spi_init(ConfigSection *c)
{
    (void)c;
    memset(gpio, 0, sizeof(gpio)); memset(spi, 0, sizeof(spi));
    memset(imu, 0, sizeof(imu));
    imu[0x75] = 0x68; imu[0x0c] = 0x58;
    selected = 0; first = 1;
    return spi;
}

uint64_t stm32f405_spi_read(void *s, uint64_t a, unsigned size)
{
    (void)s; (void)size;
    if (a >= 0x40020000 && a < 0x40020c00)
        return gpio[(a-0x40020000)/0x400][((a-0x40020000)%0x400)/4];
    for (unsigned i=0; i<3; ++i) if (a >= bases[i] && a < bases[i]+64) {
        unsigned off = (a-bases[i])/4;
        if (off == 2) return 2 | (spi[i][2] & 1);
        if (off == 3) spi[i][2] &= ~1u;
        return spi[i][off];
    }
    return 0;
}

void stm32f405_spi_write(void *s, uint64_t a, uint64_t v, unsigned size)
{
    (void)s; (void)size;
    if (a >= 0x40020000 && a < 0x40020c00) {
        unsigned bank = (a-0x40020000)/0x400, off = ((a-0x40020000)%0x400)/4;
        gpio[bank][off] = v;
        if (off == 6) {
            gpio[bank][5] = (gpio[bank][5] | (v & 0xffff)) & ~(v >> 16);
            if (bank == 0 && (v & ((1u<<4)|(1u<<20)))) {
                selected = (v & (1u<<20)) != 0; first = 1;
            }
        }
        return;
    }
    for (unsigned i=0; i<3; ++i) if (a >= bases[i] && a < bases[i]+64) {
        unsigned off = (a-bases[i])/4;
        spi[i][off] = v;
        if (off == 3) {
            uint8_t reply = 0xff;
            if (i == 0 && selected) {
                if (first) { command = v; address = v & 127; first = 0; reply = 0; }
                else if (command & 128) reply = imu[address++ & 127];
                else {
                    /* Keep immutable identity registers across sensor reset. */
                    if (address != 0x75 && address != 0x0c) imu[address & 127] = v;
                    address++; reply = 0;
                }
            }
            spi[i][3] = reply; spi[i][2] |= 1;
        }
        return;
    }
}
