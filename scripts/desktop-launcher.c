#include <mach-o/dyld.h>
#include <signal.h>
#include <spawn.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

extern char **environ;

static int mkdir_recursive(const char *path) {
  char buffer[4096];
  size_t length = strlen(path);
  if (length == 0 || length >= sizeof(buffer)) return -1;
  memcpy(buffer, path, length + 1);
  for (char *cursor = buffer + 1; *cursor; cursor++) {
    if (*cursor != '/') continue;
    *cursor = '\0';
    if (mkdir(buffer, 0755) != 0 && access(buffer, F_OK) != 0) return -1;
    *cursor = '/';
  }
  if (mkdir(buffer, 0755) != 0 && access(buffer, F_OK) != 0) return -1;
  return 0;
}

static bool healthy(const char *url) {
  pid_t pid = 0;
  char *argv[] = {"curl", "-fsS", "--max-time", "2", (char *)url, NULL};
  int status = 0;
  if (posix_spawn(&pid, "/usr/bin/curl", NULL, NULL, argv, environ) != 0) return false;
  if (waitpid(pid, &status, 0) < 0) return false;
  return WIFEXITED(status) && WEXITSTATUS(status) == 0;
}

static void launch_url(const char *url) {
  pid_t pid = 0;
  char *argv[] = {"open", (char *)url, NULL};
  if (posix_spawn(&pid, "/usr/bin/open", NULL, NULL, argv, environ) == 0) {
    waitpid(pid, NULL, 0);
  }
}

int main(void) {
  char executable[4096];
  uint32_t executable_size = sizeof(executable);
  if (_NSGetExecutablePath(executable, &executable_size) != 0) return 10;

  char resolved[4096];
  if (realpath(executable, resolved) == NULL) return 11;
  char *macos = strrchr(resolved, '/');
  if (macos == NULL) return 12;
  *macos = '\0';
  char *contents = strrchr(resolved, '/');
  if (contents == NULL) return 13;
  *contents = '\0';

  char app_dir[4096];
  char node_bin[4096];
  snprintf(app_dir, sizeof(app_dir), "%s/Resources/app", resolved);
  snprintf(node_bin, sizeof(node_bin), "%s/Resources/runtime/bin/node", resolved);

  const char *home = getenv("HOME");
  const char *configured_data = getenv("LOCAL_AGENT_DATA_DIR");
  const char *port = getenv("FIRST_LLM_STUDIO_PORT");
  if (home == NULL || home[0] == '\0') return 14;
  if (port == NULL || port[0] == '\0') port = "3011";

  char data_dir[4096];
  if (configured_data != NULL && configured_data[0] != '\0') {
    snprintf(data_dir, sizeof(data_dir), "%s", configured_data);
  } else {
    snprintf(data_dir, sizeof(data_dir), "%s/Library/Application Support/local-agent-lab/observability", home);
  }
  if (mkdir_recursive(data_dir) != 0) return 15;

  char url[256];
  char log_path[4096];
  char pid_path[4096];
  char manifest_path[4096];
  snprintf(url, sizeof(url), "http://127.0.0.1:%s/agent", port);
  snprintf(log_path, sizeof(log_path), "%s/desktop-server.log", data_dir);
  snprintf(pid_path, sizeof(pid_path), "%s/desktop-server.pid", data_dir);
  snprintf(manifest_path, sizeof(manifest_path), "%s/data/desktop-release-manifest.json", app_dir);

  if (!healthy(url)) {
    FILE *log = fopen(log_path, "a");
    if (log == NULL) return 16;
    int output_fd = fileno(log);
    posix_spawn_file_actions_t actions;
    posix_spawn_file_actions_init(&actions);
    posix_spawn_file_actions_adddup2(&actions, output_fd, STDOUT_FILENO);
    posix_spawn_file_actions_adddup2(&actions, output_fd, STDERR_FILENO);

    setenv("PORT", port, 1);
    setenv("HOSTNAME", "127.0.0.1", 1);
    setenv("LOCAL_AGENT_DATA_DIR", data_dir, 1);
    setenv("FIRST_LLM_DESKTOP_RELEASE_MANIFEST", manifest_path, 1);

    char server_path[4096];
    snprintf(server_path, sizeof(server_path), "%s/server.js", app_dir);
    char *argv[] = {node_bin, server_path, NULL};
    pid_t server_pid = 0;
    int spawned = posix_spawn(&server_pid, node_bin, &actions, NULL, argv, environ);
    posix_spawn_file_actions_destroy(&actions);
    fclose(log);
    if (spawned != 0) return 17;

    FILE *pid_file = fopen(pid_path, "w");
    if (pid_file != NULL) {
      fprintf(pid_file, "%d\n", server_pid);
      fclose(pid_file);
    }
    for (int attempt = 0; attempt < 120 && !healthy(url); attempt++) usleep(250000);
  }

  if (!healthy(url)) return 18;
  const char *no_browser = getenv("FIRST_LLM_STUDIO_NO_BROWSER");
  if (no_browser == NULL || strcmp(no_browser, "1") != 0) launch_url(url);
  return 0;
}
