#include "../filesystem_abi.h"
#include <assert.h>
#include <stdio.h>

int main(void)
{
    int flags;
    assert(adr_fs_open_flags(0, &flags) == 0 && flags == O_RDONLY);
    assert(adr_fs_open_flags(0x602, &flags) == 0 && flags == (O_RDWR | O_CREAT | O_TRUNC));
    assert(adr_fs_open_flags(0xa09, &flags) == 0 && flags == (O_WRONLY | O_CREAT | O_EXCL | O_APPEND));
    assert(adr_fs_open_flags(3, &flags) == -1);
    assert(adr_fs_open_flags(0x100000, &flags) == -1);
    struct stat s = {0};
    s.st_mode = S_IFREG | S_IRUSR | S_IWUSR;
    s.st_size = 0x12345678; s.st_blocks = 2; s.st_blksize = 4096;
    s.st_mtime = 0x123456789LL;
    uint8_t out[88];
    assert(adr_fs_stat_bytes(&s, out) == 0);
    assert(out[4] == 0x80 && out[5] == 0x81); /* regular file + owner rw */
    assert(out[16] == 0x78 && out[17] == 0x56 && out[18] == 0x34 && out[19] == 0x12);
    assert(out[40] == 0x89 && out[44] == 1); /* 64-bit time, little endian */
    assert(out[72] == 0 && out[73] == 0x10 && out[76] == 2);
    for (int i=80;i<88;i++) assert(out[i] == 0);
    s.st_size = (int64_t)INT32_MAX + 1;
    assert(adr_fs_stat_bytes(&s, out) == -1);
    s.st_size = 0; s.st_mode = S_IFLNK;
    assert(adr_fs_stat_bytes(&s, out) == -1);
    s.st_mode = S_IFDIR | S_IRUSR | S_IWUSR | S_IXUSR;
    assert(adr_fs_stat_bytes(&s, out) == 0 && out[5] == 0x41);
    puts("ArduPilot filesystem ABI conversions passed");
}
