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

[InstallDelete]
Type: files; Name: "{app}\webauthn.dll"
Type: files; Name: "{app}\vcruntime140*.dll"
Type: files; Name: "{app}\msvcp140*.dll"
Type: files; Name: "{app}\concrt140.dll"

[Files]
Source: "{#MyAppSource}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "VC_redist.x64.exe"
Source: "{#MyAppSource}\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall; Check: FileExists(ExpandConstant('{#MyAppSource}\VC_redist.x64.exe'))

[Icons]
Name: "{group}\Famous Gates"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Famous Gates"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Microsoft Visual C++ Runtime..."; Flags: waituntilterminated; Check: FileExists(ExpandConstant('{tmp}\VC_redist.x64.exe'))
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Famous Gates"; Flags: nowait postinstall skipifsilent
