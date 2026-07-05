$ErrorActionPreference = 'Stop'

$scriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$redistDir  = Join-Path $scriptDir 'redist'
New-Item -ItemType Directory -Force -Path $redistDir | Out-Null

$downloads = @(
  @{
    Name = 'VC_redist.x64.exe'
    Url  = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
  }
)

foreach ($item in $downloads) {
  $target = Join-Path $redistDir $item.Name
  if (Test-Path $target) {
    Write-Host "$($item.Name) already present, skipping download."
    continue
  }
  Write-Host "Downloading $($item.Name)..."
  Invoke-WebRequest -Uri $item.Url -OutFile $target -UseBasicParsing
  if ((Get-Item $target).Length -lt 1MB) {
    throw "Downloaded $($item.Name) but the file is unexpectedly small. Check your network/proxy."
  }
  Write-Host "  -> $('{0:N1}' -f ((Get-Item $target).Length / 1MB)) MB"
}

Write-Host ""
Write-Host "Done. Visual C++ redistributable staged in: $redistDir"
