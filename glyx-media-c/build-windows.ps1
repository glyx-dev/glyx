# build-windows.ps1
#
# Builds glyx-media.dll for Windows x64.
#
# Prerequisites:
#   - Visual Studio 2019/2022 Build Tools with MSVC (cl.exe) in PATH, OR
#     run from a "Developer PowerShell for VS" / "x64 Native Tools" prompt.
#   - Internet access to download ffmpeg (first run only).
#
# Usage:
#   .\build-windows.ps1
#   .\build-windows.ps1 -Version 1.0.0   # override DLL version
#   .\build-windows.ps1 -FfmpegDir C:\ffmpeg  # use an existing ffmpeg build

param(
    [string]$Version    = "1.0.0",
    [string]$FfmpegDir  = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputName = "glyx-media-$Version-windows-x64.dll"
$OutputPath = Join-Path $ScriptDir $OutputName

# -- 1. Locate or download ffmpeg ---------------------------------------------

if ($FfmpegDir -eq "") {
    $FfmpegDir = Join-Path $ScriptDir "ffmpeg-windows-x64"
}

if (-not (Test-Path $FfmpegDir)) {
    Write-Host "Downloading ffmpeg shared build (BtbN)..." -ForegroundColor Cyan
    $ZipUrl  = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip"
    $ZipPath = Join-Path $env:TEMP "ffmpeg-shared.zip"
    $TmpDir  = Join-Path $env:TEMP "ffmpeg-extract"

    Invoke-WebRequest $ZipUrl -OutFile $ZipPath -UseBasicParsing
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $TmpDir -Force

    # The zip contains a single top-level folder - move it to FfmpegDir.
    $Extracted = Get-ChildItem $TmpDir | Select-Object -First 1
    Move-Item $Extracted.FullName $FfmpegDir
    Remove-Item $ZipPath, $TmpDir -Recurse -Force
    Write-Host "ffmpeg extracted to: $FfmpegDir" -ForegroundColor Green
} else {
    Write-Host "Using existing ffmpeg at: $FfmpegDir" -ForegroundColor Green
}

$IncDir = Join-Path $FfmpegDir "include"
$LibDir = Join-Path $FfmpegDir "lib"
$BinDir = Join-Path $FfmpegDir "bin"

if (-not (Test-Path (Join-Path $IncDir "libavformat\avformat.h"))) {
    Write-Error "ffmpeg headers not found at $IncDir. Delete '$FfmpegDir' and re-run to re-download."
}

# -- 2. Set up MSVC environment (vcvars64) ------------------------------------
#
# cl.exe needs INCLUDE, LIB, PATH etc. populated by vcvars64.bat.
# We source it via cmd /c and import every env var it sets into this process.

$VsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (-not (Test-Path $VsWhere)) {
    # Try the x64 path on some machines
    $VsWhere = "${env:ProgramFiles}\Microsoft Visual Studio\Installer\vswhere.exe"
}

if (-not (Test-Path $VsWhere)) {
    Write-Error ("vswhere.exe not found. Install 'Build Tools for Visual Studio 2022':`n" +
        "  https://aka.ms/vs/17/release/vs_BuildTools.exe`n" +
        "  (select the 'C++ build tools' workload)")
    exit 1
}

$VsPath   = & $VsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
$Vcvars   = Join-Path $VsPath "VC\Auxiliary\Build\vcvars64.bat"

if (-not (Test-Path $Vcvars)) {
    Write-Error "vcvars64.bat not found at: $Vcvars"
    exit 1
}

Write-Host "Sourcing MSVC environment from: $Vcvars" -ForegroundColor Cyan

# Run vcvars64.bat and capture every environment variable it sets
$EnvLines = cmd /c "`"$Vcvars`" > nul 2>&1 && set"
foreach ($line in $EnvLines) {
    if ($line -match "^([^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}

$Cl = "cl.exe"   # now in PATH thanks to vcvars
Write-Host "MSVC environment ready." -ForegroundColor Green

# -- 3. Compile ---------------------------------------------------------------

Write-Host "`nCompiling $OutputName ..." -ForegroundColor Cyan

$Source = Join-Path $ScriptDir "glyx_media.c"
$ObjDir = Join-Path $ScriptDir "obj-windows"
New-Item $ObjDir -ItemType Directory -Force | Out-Null

# Import libraries for the shared ffmpeg build.
$Libs    = @("avformat", "avcodec", "avfilter", "swscale", "swresample", "avutil") |
    ForEach-Object { Join-Path $LibDir "$_.lib" }
$LibList = ($Libs | ForEach-Object { "`"$_`"" }) -join " "

# Build the full command as a single string and run via cmd /c.
# This avoids PowerShell's native-process argument quoting quirks (e.g.
# trailing backslash in /Fo:"path\" being interpreted as an escaped quote).
# Forward slash in /Fo path is valid for MSVC and sidesteps the issue.
$ObjDirFwd = $ObjDir -replace '\\', '/'
$CmdLine = "cl.exe /LD /O2 /W3 /I`"$IncDir`" `"$Source`" /Fe:`"$OutputPath`" /Fo:`"$ObjDirFwd/`" /link /LIBPATH:`"$LibDir`" $LibList"
cmd /c $CmdLine
if ($LASTEXITCODE -ne 0) { throw "Compilation failed (exit $LASTEXITCODE)" }

Write-Host "`nBuilt: $OutputPath" -ForegroundColor Green

# -- 4. Copy ffmpeg DLLs alongside our DLL ------------------------------------

Write-Host "Copying ffmpeg runtime DLLs ..." -ForegroundColor Cyan
$FfmpegDlls = Get-ChildItem (Join-Path $BinDir "*.dll") |
    Where-Object { $_.Name -match "^(avformat|avcodec|avfilter|swscale|swresample|avutil|avdevice|postproc)" }
foreach ($dll in $FfmpegDlls) {
    Copy-Item $dll.FullName (Join-Path $ScriptDir $dll.Name) -Force
    Write-Host "  $($dll.Name)"
}

# -- 5. Cache to ~/.glyx/cache/media/ ----------------------------------------

$CacheDir = Join-Path $env:USERPROFILE ".glyx\cache\media"
New-Item $CacheDir -ItemType Directory -Force | Out-Null
Copy-Item $OutputPath (Join-Path $CacheDir $OutputName) -Force
Write-Host "`nCached: $CacheDir\$OutputName" -ForegroundColor Green

# Also copy ffmpeg DLLs to cache so they're found when the DLL is loaded from there.
Write-Host "Copying ffmpeg runtime DLLs to cache..." -ForegroundColor Cyan
foreach ($dll in $FfmpegDlls) {
    Copy-Item $dll.FullName (Join-Path $CacheDir $dll.Name) -Force
    Write-Host "  $($dll.Name)"
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  .\generate-dev-manifest.ps1 -Version $Version"
Write-Host '  $env:GLYX_MEDIA_SKIP_VERIFY = "1"'
Write-Host "  glyx dev"
