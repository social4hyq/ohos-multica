#include <stdio.h>
#include <unistd.h>
int main(void) {
  puts("ROUTE1_PROBE_V1");
  printf("UID=%lu\n", (unsigned long)getuid());
  printf("HOST_AGENT_ACCESS=%d\n", access("/storage/Users/currentUser/.harmonybrew/bin/codex", R_OK | X_OK) == 0);
  printf("HOST_CONFIG_ACCESS=%d\n", access("/storage/Users/currentUser/.codex/config.toml", R_OK) == 0);
  printf("HOST_MULTICA_ACCESS=%d\n", access("/storage/Users/currentUser/.multica/config.json", R_OK) == 0);
  return 0;
}
