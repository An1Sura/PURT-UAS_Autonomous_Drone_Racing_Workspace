/* MPU6000 diagnostic FIFO model: 8 kHz raw samples, 14 bytes/sample.
 * Timing is QEMU virtual time; repeated FMU values are zero-order held.
 * The 1024-byte device FIFO holds 73 complete 14-byte records.
 */
#pragma once
#include <stdint.h>
#include <stdbool.h>
typedef struct { uint64_t sample_index, dropped; unsigned pending; bool started; } AdrFifoClock;
static inline unsigned adr_fifo_available(AdrFifoClock *f, uint64_t ns)
{
    uint64_t index = ns / 125000;
    if (!f->started) { f->started = true; f->sample_index = index; return 0; }
    uint64_t added = index - f->sample_index;
    f->sample_index = index;
    uint64_t total = f->pending + added;
    if (total > 73) { f->dropped += total - 73; total = 73; }
    f->pending = (unsigned)total;
    return f->pending;
}
static inline bool adr_fifo_consume(AdrFifoClock *f, unsigned samples)
{
    if (samples > f->pending) return false;
    f->pending -= samples;
    return true;
}
