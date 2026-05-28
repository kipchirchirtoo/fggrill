#include "my_application.h"

#include <limits.h>
#include <unistd.h>

#include <string>

namespace {

void set_working_directory_to_executable() {
  char executable_path[PATH_MAX];
  ssize_t length =
      readlink("/proc/self/exe", executable_path, sizeof(executable_path) - 1);
  if (length <= 0) {
    return;
  }

  executable_path[length] = '\0';
  std::string path(executable_path);
  const std::size_t slash = path.find_last_of('/');
  if (slash == std::string::npos) {
    return;
  }

  const std::string directory = path.substr(0, slash);
  if (!directory.empty()) {
    chdir(directory.c_str());
  }
}

}  // namespace

int main(int argc, char** argv) {
  set_working_directory_to_executable();
  g_autoptr(MyApplication) app = my_application_new();
  return g_application_run(G_APPLICATION(app), argc, argv);
}
