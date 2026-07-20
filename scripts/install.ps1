# Glyx CLI installer (Windows)
#
#   irm https://glyx.dev/install.ps1 | iex
#   (or: irm https://github.com/glyx-dev/glyx/releases/latest/download/install.ps1 | iex)
#
# Installs glyx.exe to %USERPROFILE%\.glyx\bin and adds it to the user PATH.
$ErrorActionPreference = 'Stop'

$Repo       = 'glyx-dev/glyx'
$InstallDir = if ($env:GLYX_INSTALL_DIR) { $env:GLYX_INSTALL_DIR } else { Join-Path $env:USERPROFILE '.glyx\bin' }
$Target     = 'x86_64-pc-windows-msvc'

if ($env:GLYX_VERSION) {
  $Url = "https://github.com/$Repo/releases/download/$($env:GLYX_VERSION)/glyx-$Target.exe"
} else {
  $Url = "https://github.com/$Repo/releases/latest/download/glyx-$Target.exe"
}

Write-Host "Downloading glyx ($Target)..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$Dest = Join-Path $InstallDir 'glyx.exe'
Invoke-WebRequest -Uri $Url -OutFile $Dest -UseBasicParsing

Write-Host ""
Write-Host "* glyx installed to $Dest" -ForegroundColor Green

# Add to user PATH if missing (takes effect in NEW terminals).
$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($UserPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable('Path', "$InstallDir;$UserPath", 'User')
  Write-Host "* Added $InstallDir to your user PATH (open a new terminal to use it)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Get started:  glyx create my-app"
