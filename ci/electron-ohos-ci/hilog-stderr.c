#include <stdarg.h>
#include <stdio.h>
#include <string.h>
/* Diagnostic container adapter for the OS logging API, not compiler logic. */
int HiLogPrint(int type, int level, unsigned int domain, const char *tag, const char *fmt, ...) {
  (void)type; (void)level; (void)domain;
  char clean[4096]; size_t j=0;
  for (size_t i=0; fmt && fmt[i] && j+1<sizeof(clean); ++i) {
    if (fmt[i]=='%' && fmt[i+1]=='{') {
      clean[j++]='%'; i+=2;
      while (fmt[i] && fmt[i]!='}') ++i;
      if (!fmt[i]) break;
    } else clean[j++]=fmt[i];
  }
  clean[j]=0; fprintf(stderr,"[%s] ",tag?tag:"");
  va_list args; va_start(args,fmt); int count=vfprintf(stderr,clean,args); va_end(args);
  fputc('\n',stderr); return count;
}
