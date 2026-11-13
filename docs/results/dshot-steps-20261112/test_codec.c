#include <assert.h>
#include <math.h>
#include <stdio.h>
#include "adr_virtual_dshot.h"
int main(void) {
 unsigned valid=0, flips=0;
 for (unsigned code=0;code<=2047;code++) {
  float y=-1; uint16_t frame=adr_dshot_frame(code);
  bool ok=adr_dshot_decode(frame,&y);
  assert(ok==(code==0 || code>=48));
  if(ok) { assert(fabsf(y-(code==0?0.0f:(code-48)/1999.0f))<1e-7f); valid++; }
  for(unsigned bit=0;bit<16;bit++){assert(!adr_dshot_decode(frame^(1U<<bit),&y));flips++;}
 }
 assert(adr_dshot_frame(0)==0); assert(adr_dshot_frame(2047)==0xffee);
 printf("PASS: %u valid throttle/stop codes, 47 reserved commands rejected, %u single-bit corruptions rejected\n",valid,flips);
}
