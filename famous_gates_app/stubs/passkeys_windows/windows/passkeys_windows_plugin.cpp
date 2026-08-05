#include "include/passkeys_windows/passkeys_windows_plugin.h"

#include <flutter/plugin_registrar_windows.h>

void PasskeysWindowsPluginRegisterWithRegistrar(
    FlutterDesktopPluginRegistrarRef registrar) {
  // No-op stub to prevent webauthn.dll linkage failures on Windows 10 < 1903
}
