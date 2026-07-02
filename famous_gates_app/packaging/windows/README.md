# FamousGate Windows Installer

This folder contains the reproducible Windows installer source for the Flutter desktop build.

## What It Fixes

- Bundles and silently installs both Microsoft Visual C++ Redistributables:
  - `VC_redist.x64.exe` for the 64-bit Flutter app.
  - `VC_redist.x86.exe` for legacy 32-bit printer/cash-drawer/peripheral drivers that still need x86 runtime DLLs.
- Creates Start Menu and Desktop shortcuts using installer variables only:
  - `{app}` for the installed executable.
  - `{autoprograms}` and `{autodesktop}` for shortcuts.
- Warns clearly on Windows versions older than Windows 10 instead of allowing a cryptic missing-DLL failure.
- Hard-blocks only 32-bit Windows because the current Flutter build output is x64-only.

## Build

From `famous_gates_app`:

```powershell
flutter build windows --release
powershell -ExecutionPolicy Bypass -File packaging/windows/prepare-redists.ps1
```

Then compile `packaging/windows/famousgate_hotels_system.iss` with Inno Setup 6.

Or run the full helper:

```powershell
powershell -ExecutionPolicy Bypass -File packaging/windows/build-installer.ps1
```

Output is written to:

```text
packaging/windows/output/FamousGate-Hotels-System-Setup-3.9.9-x64.exe
```

## Architecture Notes

The current committed Flutter Windows project builds under:

```text
build/windows/x64/runner/Release
```

That means the app itself is x64-only. The installer includes the x86 VC++ runtime for legacy peripheral dependencies, but it does not make the app executable on 32-bit Windows.

## Manual Test Checklist

1. Test on a clean Windows 10 x64 VM with no Visual C++ Redistributable installed.
2. Install using a non-default path, then confirm Start Menu and Desktop shortcuts launch `{app}\famousgate_hotels_system.exe`.
3. Confirm `flutter_windows.dll`, `pdfium.dll`, `sqlite3.dll`, `powersync_x64.dll`, and plugin DLLs are present beside the EXE.
4. Test on an older Windows 7/8.1 x64 machine or VM and confirm the compatibility warning appears before install.
5. Confirm the installer installs both x64 and x86 VC++ runtimes silently.
6. Connect/test branch peripherals that require legacy x86 drivers, especially thermal printers and cash drawers.
7. Uninstall and confirm shortcuts and installed files are removed cleanly.
