/* SPDX-License-Identifier: Apache-2.0
 * Shared command-level, unidirectional DShot codec. No electrical timing model.
 */
#ifndef ADR_VIRTUAL_DSHOT_H
#define ADR_VIRTUAL_DSHOT_H
#include <stdint.h>
#include <stdbool.h>
static inline uint16_t adr_dshot_frame(uint16_t code) {
    uint16_t payload = (code & 2047U) << 1; /* telemetry request off */
    return (uint16_t)((payload << 4) | ((payload ^ (payload >> 4) ^ (payload >> 8)) & 15U));
}
static inline bool adr_dshot_decode(uint16_t frame, float *normalized) {
    uint16_t payload = frame >> 4;
    if (((payload ^ (payload >> 4) ^ (payload >> 8)) & 15U) != (frame & 15U)) return false;
    uint16_t code = payload >> 1;
    if (code > 0U && code < 48U) return false; /* unsupported ESC command */
    *normalized = code == 0U ? 0.0f : (float)(code - 48U) / 1999.0f;
    return true;
}
#endif
