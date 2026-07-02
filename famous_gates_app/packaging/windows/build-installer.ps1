$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Resolve-Path (Join-Path $scriptDir '..\..')
$issPath = Join-Path $scriptDir 'famousgate_hotels_system.iss'

Push-Location $appDir
try {
  flutter build windows --release
  powershell -ExecutionPolicy Bypass -File (Join-Path $scriptDir 'prepare-redists.ps1')
}
finally {
  Pop-Location
}

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
  $candidatePaths = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
  )
  foreach ($path in $candidatePaths) {
    if ($path -and (Test-Path $path)) {
      $iscc = Get-Item $path
      break
    }
  }
}

if (-not $iscc) {
  throw 'Inno Setup 6 compiler (ISCC.exe) was not found. Install Inno Setup 6 or add ISCC.exe to PATH.'
}

Push-Location $scriptDir
try {
  & $iscc.Source $issPath
}
finally {
  Pop-Location
}
