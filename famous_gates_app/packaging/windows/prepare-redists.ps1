$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$redistDir = Join-Path $scriptDir 'redist'
New-Item -ItemType Directory -Force -Path $redistDir | Out-Null

$downloads = @(
  @{
    Name = 'VC_redist.x64.exe'
    Url = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
  },
  @{
    Name = 'VC_redist.x86.exe'
    Url = 'https://aka.ms/vs/17/release/vc_redist.x86.exe'
  }
)

foreach ($item in $downloads) {
  $target = Join-Path $redistDir $item.Name
  Write-Host "Downloading $($item.Name)..."
  Invoke-WebRequest -Uri $item.Url -OutFile $target
  if ((Get-Item $target).Length -lt 1MB) {
    throw "Downloaded $($item.Name), but the file is unexpectedly small. Check network/proxy and try again."
  }
}

Write-Host "Visual C++ redistributables staged in $redistDir"
