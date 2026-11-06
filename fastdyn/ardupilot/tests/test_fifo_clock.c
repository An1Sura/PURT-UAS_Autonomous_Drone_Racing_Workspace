#include <assert.h>
#include "../fifo_clock.h"
int main(void) {
    AdrFifoClock f = {0};
    assert(adr_fifo_available(&f, 1000000000) == 0);
    assert(adr_fifo_available(&f, 1001000000) == 8);
    assert(adr_fifo_consume(&f, 8));
    assert(adr_fifo_available(&f, 1001000000) == 0);
    assert(adr_fifo_available(&f, 1001100000) == 0);
    assert(adr_fifo_available(&f, 1001250000) == 2);
    assert(!adr_fifo_consume(&f, 3));
    assert(adr_fifo_consume(&f, 1));
    assert(adr_fifo_available(&f, 1002000000) == 7);
    assert(adr_fifo_consume(&f, 7));
    for (uint64_t i=1; i<=1000; ++i) {
        assert(adr_fifo_available(&f, 1002000000+i*1000000) == 8);
        assert(adr_fifo_consume(&f, 8));
    }
    assert(adr_fifo_available(&f, 3002000000) == 73);
    assert(f.dropped == 7927);
}
