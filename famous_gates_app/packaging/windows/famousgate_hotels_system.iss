; FamousGate Hotels System Windows installer.
; Build the app first:
;   flutter build windows --release
; Then stage runtimes:
;   powershell -ExecutionPolicy Bypass -File packaging/windows/prepare-redists.ps1
; Compile this script with Inno Setup 6.

#define MyAppName      "FamousGate Hotels System"
#define MyAppPublisher "Famous Gates Hotels"
#define MyAppExeName   "famousgate_hotels_system.exe"
#define MyAppVersion   "3.9.9"
#define BuildDir       "..\..\build\windows\x64\runner\Release"
#define RedistDir      "redist"

[Setup]
AppId={{D7D18239-C4AC-4E49-9176-DAF3397B830F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}

; ── Install location ──────────────────────────────────────────────────────────
; Per-user install in %LocalAppData%\Programs\Famous Gates\
; No admin rights needed. Matches what hotel PCs expect.
DefaultDirName={localappdata}\Programs\Famous Gates
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; ── Output ────────────────────────────────────────────────────────────────────
OutputDir=output
OutputBaseFilename=FamousGate-Hotels-System-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

; ── Platform ──────────────────────────────────────────────────────────────────
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0

; ── Misc ──────────────────────────────────────────────────────────────────────
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
; ── Main application bundle (all files from flutter release build) ─────────────
Source: "{#BuildDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; ── Visual C++ runtimes ───────────────────────────────────────────────────────
Source: "{#RedistDir}\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
; Start Menu shortcut  →  %AppData%\Microsoft\Windows\Start Menu\Programs\FamousGate Hotels System.lnk
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"
; Desktop shortcut (optional – user can uncheck)
Name: "{autodesktop}\{#MyAppName}";   Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Install VC++ runtime silently
Filename: "{tmp}\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Microsoft Visual C++ Runtime..."; Flags: waituntilterminated

; Optionally launch the app after install
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove any leftover files/folders not tracked by the installer
Type: filesandordirs; Name: "{app}"

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;

  if not IsWin64 then
  begin
    MsgBox(
      '{#MyAppName} is a 64-bit Windows application.' + #13#10#13#10 +
      'This installer requires a 64-bit version of Windows 10 or newer.',
      mbCriticalError,
      MB_OK
    );
    Result := False;
  end;
end;
