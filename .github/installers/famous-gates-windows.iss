#define MyAppName "Famous Gates"
#define MyAppPublisher "Famous Gates Hotels"
; MUST match BINARY_NAME in famous_gates_app/windows/CMakeLists.txt.
; The Flutter release build produces famousgate_hotels_system.exe — using the
; old name here makes the [Run]/[Icons]/uninstaller point at a file that does
; not exist ("CreateProcess failed; code 2").
#define MyAppExeName "famousgate_hotels_system.exe"
#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
#ifndef MyAppSource
#define MyAppSource "..\..\famous_gates_app\build\windows\x64\runner\Release"
#endif
#ifndef MyAppOutput
#define MyAppOutput "..\..\famous_gates_app\dist"
#endif

[Setup]
AppId={{9C063867-9C8B-4C3D-92B3-F8A68E56C461}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Famous Gates
DefaultGroupName=Famous Gates
DisableProgramGroupPage=yes
OutputDir={#MyAppOutput}
OutputBaseFilename=FamousGates-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
SetupIconFile=..\..\famous_gates_app\windows\runner\resources\app_icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
PrivilegesRequired=lowest

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "{#MyAppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── WebAuthn shim for older Windows ───────────────────────────────────────────
; The transitive `passkeys` plugin (pulled in by Supabase gotrue) ships
; passkeys_windows_plugin.dll, which imports WebAuthNCancelCurrentOperation —
; only present in webauthn.dll on Windows 10 1903+. Bundling the build host's
; newer webauthn.dll next to the exe makes the loader resolve it from the app
; folder, so the app launches on machines with an older system webauthn.dll.
Source: "{sys}\webauthn.dll"; DestDir: "{app}"; Flags: ignoreversion onlyifdoesntexist; Check: FileExists(ExpandConstant('{sys}\webauthn.dll'))

[Icons]
Name: "{group}\Famous Gates"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Famous Gates"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Famous Gates"; Flags: nowait postinstall skipifsilent
