$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Resolve-Path (Join-Path $scriptDir '..\..')
$issPath = Join-Path $scriptDir 'famousgate_hotels_system.iss'

Push-Location $appDir
try {
  # Without these, AppConfig.mainApiBaseUrl falls back to its
  # http://localhost:5000/api default and the built app can never reach the
  # real backend (login fails with "connection refused" — the request never
  # leaves the terminal machine). See famous_gates_app/.env.example.
  flutter build windows --release `
    --dart-define=MAIN_API_URL=https://api.hirall.com/api `
    --dart-define=PYTHON_SERVICES_URL=https://services.hirall.com
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
