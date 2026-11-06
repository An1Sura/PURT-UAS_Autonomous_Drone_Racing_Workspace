/* Linux host storage primitives for the FMUv3 filesystem adapter.
 * Guest absolute paths are rooted inside the configured simulation directory.
 * Never follow guest-controlled symlinks or traverse above that directory.
 */
#ifndef ADR_FILESYSTEM_HOST_H
#define ADR_FILESYSTEM_HOST_H
#include "filesystem_abi.h"
#include <errno.h>
#include <unistd.h>
#include <sys/statvfs.h>

static inline int adr_fs_parent(const char *root, const char *guest, char leaf[256])
{
    if (!root || !guest || !guest[0] || strlen(guest) >= 256 || strchr(guest, '@')) {
        errno = EINVAL; return -1;
    }
    char copy[256]; strcpy(copy,guest);
    int fd = open(root, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (fd < 0) return -1;
    char *save = NULL, *part = strtok_r(copy, "/", &save);
    if (!part) { strcpy(leaf,"."); return fd; }
    while (part) {
        if (!strcmp(part,"..")) { close(fd); errno = EACCES; return -1; }
        char *next = strtok_r(NULL, "/", &save);
        if (!next) { strcpy(leaf,part); return fd; }
        int child = openat(fd,part,O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
        int error = errno; close(fd);
        if (child < 0) { errno = error; return -1; }
        fd = child; part = next;
    }
    close(fd); errno = EINVAL; return -1;
}

static inline int adr_fs_open(const char *root, const char *guest, uint32_t flags)
{
    int host;
    if (adr_fs_open_flags(flags,&host)) { errno = EINVAL; return -1; }
    char leaf[256]; int parent = adr_fs_parent(root,guest,leaf);
    if (parent < 0) return -1;
    int fd = openat(parent,leaf,host | O_NOFOLLOW | O_CLOEXEC,0600);
    int error = errno; close(parent); errno = error; return fd;
}

static inline int adr_fs_stat(const char *root, const char *guest, uint8_t out[88])
{
    char leaf[256]; int parent = adr_fs_parent(root,guest,leaf);
    if (parent < 0) return -1;
    struct stat s;
    int result = fstatat(parent,leaf,&s,AT_SYMLINK_NOFOLLOW);
    int error = errno; close(parent);
    if (!result && adr_fs_stat_bytes(&s,out)) { result = -1; error = EOVERFLOW; }
    errno = error; return result;
}

static inline int adr_fs_mkdir(const char *root, const char *guest)
{
    char leaf[256]; int parent = adr_fs_parent(root,guest,leaf);
    if (parent < 0) return -1;
    int result = mkdirat(parent,leaf,0700);
    int error = errno; close(parent); errno = error; return result;
}

static inline int64_t adr_fs_capacity(const char *root, const char *guest, int available)
{
    int fd = adr_fs_open(root,guest,0);
    if (fd < 0) return -1;
    struct statvfs s;
    int result = fstatvfs(fd,&s), error = errno; close(fd);
    if (result) { errno = error; return -1; }
    uint64_t blocks = available ? s.f_bavail : s.f_blocks;
    if (s.f_frsize && blocks > INT64_MAX / s.f_frsize) { errno = EOVERFLOW; return -1; }
    return (int64_t)(blocks*s.f_frsize);
}
#endif
