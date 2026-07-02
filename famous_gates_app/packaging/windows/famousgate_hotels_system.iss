; FamousGate Hotels System Windows installer.
; Build the app first:
;   flutter build windows --release
; Then stage runtimes:
;   powershell -ExecutionPolicy Bypass -File packaging/windows/prepare-redists.ps1
; Compile this script with Inno Setup 6.

#define MyAppName "FamousGate Hotels System"
#define MyAppPublisher "Famous Gates Hotels"
#define MyAppExeName "famousgate_hotels_system.exe"
#define MyAppVersion "3.9.9"
#define BuildDir "..\..\build\windows\x64\runner\Release"
#define RedistDir "redist"

[Setup]
AppId={{D7D18239-C4AC-4E49-9176-DAF3397B830F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\FamousGate Hotels System
DefaultGroupName={#MyAppName}
OutputDir=output
OutputBaseFilename=FamousGate-Hotels-System-Setup-{#MyAppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: checkedonce

[Files]
Source: "{#BuildDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#RedistDir}\VC_redist.x64.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall
Source: "{#RedistDir}\VC_redist.x86.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{tmp}\VC_redist.x64.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Microsoft Visual C++ Runtime (x64)..."; Flags: waituntilterminated
Filename: "{tmp}\VC_redist.x86.exe"; Parameters: "/install /quiet /norestart"; StatusMsg: "Installing Microsoft Visual C++ Runtime (x86 for legacy drivers/peripherals)..."; Flags: waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
function InitializeSetup(): Boolean;
var
  Version: TWindowsVersion;
  Message: String;
begin
  Result := True;

  if not IsWin64 then
  begin
    MsgBox(
      '{#MyAppName} is currently packaged as a 64-bit Flutter Windows app.' + #13#10#13#10 +
      'This installer cannot run the app on 32-bit Windows. Use a 64-bit Windows machine, or produce a separate 32-bit app build if the framework/toolchain supports it.',
      mbCriticalError,
      MB_OK
    );
    Result := False;
    Exit;
  end;

  GetWindowsVersionEx(Version);
  if Version.Major < 10 then
  begin
    Message :=
      '{#MyAppName} is tested for Windows 10 and newer.' + #13#10#13#10 +
      'This machine appears to be running an older Windows version. The installer will add the Visual C++ runtimes required by Flutter apps, but Microsoft no longer fully supports some legacy Windows builds.' + #13#10#13#10 +
      'Continue installation?';
    Result := SuppressibleMsgBox(Message, mbConfirmation, MB_YESNO, IDYES) = IDYES;
  end;
end;
