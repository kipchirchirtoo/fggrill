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
; NOTE: the WebAuthn shim (webauthn.dll — see the release workflow) is staged
; INTO {#MyAppSource} by the CI Windows build step, so the wildcard above bundles
; it automatically. It must NOT be listed here with a "{sys}\webauthn.dll" source:
; Inno resolves [Files] Source paths at COMPILE time and {sys} is a run-time
; constant, so ISCC failed with 'Source file "{sys}\webauthn.dll" does not exist'.

[Icons]
Name: "{group}\Famous Gates"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Famous Gates"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Famous Gates"; Flags: nowait postinstall skipifsilent
