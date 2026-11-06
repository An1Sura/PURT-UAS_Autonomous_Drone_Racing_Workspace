#include "../filesystem_host.h"
#include <assert.h>
#include <stdlib.h>
#include <stdio.h>

int main(void)
{
    char root[]="/tmp/adr-fs-XXXXXX"; assert(mkdtemp(root));
    assert(adr_fs_mkdir(root,"/APM") == 0);
    assert(adr_fs_mkdir(root,"/APM/LOGS") == 0);
    int fd = adr_fs_open(root,"/APM/LOGS/1.BIN",0x601);
    assert(fd >= 0); assert(write(fd,"flight",6) == 6); close(fd);
    uint8_t out[88]; assert(adr_fs_stat(root,"/APM/LOGS/1.BIN",out) == 0 && out[16] == 6);
    fd = adr_fs_open(root,"/APM/LOGS/1.BIN",0); assert(fd >= 0);
    char bytes[6]; assert(read(fd,bytes,6) == 6 && !memcmp(bytes,"flight",6)); close(fd);
    assert(adr_fs_open(root,"/APM/LOGS/missing",0) == -1 && errno == ENOENT);
    assert(adr_fs_open(root,"../outside",0x201) == -1 && errno == EACCES);
    char link[512]; snprintf(link,sizeof(link),"%s/link",root); assert(symlink("/tmp",link) == 0);
    assert(adr_fs_open(root,"link/outside",0x201) == -1);
    assert(adr_fs_stat(root,"link",out) == -1);
    assert(adr_fs_capacity(root,"/APM/LOGS",1) >= 0);
    assert(adr_fs_capacity(root,"/APM/LOGS",0) > 0);
    unlink(link);
    snprintf(link,sizeof(link),"%s/APM/LOGS/1.BIN",root); unlink(link);
    snprintf(link,sizeof(link),"%s/APM/LOGS",root); rmdir(link);
    snprintf(link,sizeof(link),"%s/APM",root); rmdir(link); rmdir(root);
    puts("ArduPilot rooted host filesystem tests passed");
}
