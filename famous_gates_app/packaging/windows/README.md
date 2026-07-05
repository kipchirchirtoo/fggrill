# FamousGate Hotels System — Windows Installer

## Prerequisites
- Flutter SDK (with `flutter build windows --release` working)
- [Inno Setup 6](https://jrsoftware.org/isinfo.php) installed on your build machine
- Internet access (to download VC++ redistributable)

---

## Build Steps

### 1. Build the release app
```powershell
cd <repo_root>/famous_gates_app
flutter build windows --release
```
Output: `build\windows\x64\runner\Release\famousgate_hotels_system.exe`

### 2. Stage the redistributables
```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\prepare-redists.ps1
```

### 3. Compile the installer
```powershell
powershell -ExecutionPolicy Bypass -File packaging\windows\build-installer.ps1
```
Output installer: `packaging\windows\output\FamousGate-Hotels-System-Setup-3.9.9-x64.exe`

---

## What the installer does

| Item | Detail |
|------|--------|
| **Install location** | `C:\Users\<name>\AppData\Local\Programs\Famous Gates\` |
| **Executable** | `famousgate_hotels_system.exe` |
| **Start Menu shortcut** | `%AppData%\Microsoft\Windows\Start Menu\Programs\FamousGate Hotels System.lnk` |
| **Desktop shortcut** | Optional (checked by default) |
| **Admin required?** | No — per-user install |
| **VC++ Runtime** | Installed silently (x64) |
| **webauthn.dll** | Copied from System32 to app folder (fixes passkeys/biometric DLL errors) |

## Launch from PowerShell (manual)
```powershell
Start-Process "$env:LOCALAPPDATA\Programs\Famous Gates\famousgate_hotels_system.exe"
```

---

## Troubleshooting

### Error code 2 — "The system cannot find the file specified"
The shortcut was pointing to the old name `famous_gates_app.exe`. This is now fixed — the installer correctly targets `famousgate_hotels_system.exe`.

### webauthn.dll / DLL missing errors
The installer now copies `webauthn.dll` from `System32` into the app folder. The VC++ x64 runtime is also installed silently. If you still see DLL errors, install the latest [Visual C++ 2015-2022 Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe) manually.
