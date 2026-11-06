/* ArduCopter v4.6.2 FMUv3 binary ABI, verified with DWARF (88-byte stat).
 * Native host structures must never be copied directly into guest memory.
 * Pure conversion helpers only; this is not a complete filesystem adapter.
 */
#ifndef ADR_FILESYSTEM_ABI_H
#define ADR_FILESYSTEM_ABI_H
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <fcntl.h>
#include <limits.h>
#include <sys/stat.h>

static inline void adr_fs_put_le(uint8_t *p, uint64_t value, size_t n)
{
    for (size_t i = 0; i < n; ++i) p[i] = (uint8_t)(value >> (8 * i));
}

/* ARM newlib flags differ from Linux host flags. Unknown flags are rejected. */
static inline int adr_fs_open_flags(uint32_t guest, int *host)
{
    const uint32_t known = 3u | 0x8u | 0x200u | 0x400u | 0x800u;
    if ((guest & ~known) || (guest & 3u) == 3u) return -1;
    *host = (guest & 3u) == 0 ? O_RDONLY : (guest & 3u) == 1 ? O_WRONLY : O_RDWR;
    if (guest & 0x8u) *host |= O_APPEND;
    if (guest & 0x200u) *host |= O_CREAT;
    if (guest & 0x400u) *host |= O_TRUNC;
    if (guest & 0x800u) *host |= O_EXCL;
    return 0;
}

/* Only regular files and directories are represented by this SD-card model.
 * Reject sizes that the guest's signed 32-bit off_t cannot represent.
 */
static inline int adr_fs_stat_bytes(const struct stat *s, uint8_t out[88])
{
    if ((!S_ISREG(s->st_mode) && !S_ISDIR(s->st_mode)) ||
        s->st_size < 0 || (uint64_t)s->st_size > INT32_MAX ||
        s->st_blocks < 0 || (uint64_t)s->st_blocks > INT32_MAX ||
        s->st_blksize < 0 || (uint64_t)s->st_blksize > INT32_MAX) return -1;
    memset(out, 0, 88);
    /* Guest mode constants come from newlib sys/stat.h, not host bit layout. */
    const uint32_t mode = (S_ISDIR(s->st_mode) ? 0040000u : 0100000u) |
        ((s->st_mode & S_IRUSR) ? 0400u : 0) |
        ((s->st_mode & S_IWUSR) ? 0200u : 0) |
        ((s->st_mode & S_IXUSR) ? 0100u : 0);
    adr_fs_put_le(out + 4, mode, 4);
    adr_fs_put_le(out + 8, 1, 2);
    adr_fs_put_le(out + 16, (uint32_t)s->st_size, 4);
    adr_fs_put_le(out + 24, (uint64_t)s->st_atime, 8);
    adr_fs_put_le(out + 40, (uint64_t)s->st_mtime, 8);
    adr_fs_put_le(out + 56, (uint64_t)s->st_ctime, 8);
    adr_fs_put_le(out + 72, (uint32_t)s->st_blksize, 4);
    adr_fs_put_le(out + 76, (uint32_t)s->st_blocks, 4);
    return 0;
}
#endif
