# generate-dev-manifest.ps1
#
# Creates a dev manifest + zero-signature for a locally-built DLL so
# glyx-media's verify.rs accepts it when GLYX_MEDIA_SKIP_VERIFY=1.
#
# Usage:
#   .\generate-dev-manifest.ps1 -Version 0.2.0   # default: the Glyx version

param(
    [string]$Version   = "",
    [string]$Platform  = "windows",
    [string]$Arch      = "x64"
)

$GlyxMediaToml = Join-Path $PSScriptRoot "..\crates\glyx-media\Cargo.toml"
if (-not $Version) {
    # Default to the Glyx version: glyx looks for glyx-media-<that version>-... in its cache.
    $Version = (Select-String -Path $GlyxMediaToml -Pattern '^version\s*=\s*"(.+)"' |
        Select-Object -First 1).Matches[0].Groups[1].Value
}

$Stem     = "glyx-media-$Version-$Platform-$Arch"
$DllName  = "$Stem.dll"
$CacheDir = Join-Path $env:USERPROFILE ".glyx\cache\media"
$DllPath  = Join-Path $CacheDir $DllName

if (-not (Test-Path $DllPath)) {
    Write-Host "ERROR: DLL not found at: $DllPath" -ForegroundColor Red
    Write-Host "Run build-windows.ps1 first." -ForegroundColor Yellow
    exit 1
}

# Ensure cache dir exists (it should, but be safe)
New-Item $CacheDir -ItemType Directory -Force | Out-Null

# SHA-256 hash of the DLL
$Hash = (Get-FileHash $DllPath -Algorithm SHA256).Hash.ToLower()

$Manifest = @{
    version = $Version
    url     = "https://cdn.glyx.dev/media/$Version/$DllName"
    sha256  = $Hash
} | ConvertTo-Json -Compress

$ManifestPath = Join-Path $CacheDir "$Stem.manifest.json"
$SigPath      = Join-Path $CacheDir "$Stem.manifest.sig"

# Use UTF8Encoding($false) to write WITHOUT BOM — serde_json rejects BOM-prefixed files.
[System.IO.File]::WriteAllText($ManifestPath, $Manifest, (New-Object System.Text.UTF8Encoding($false)))
# 64 zero bytes = dummy signature (only valid when GLYX_MEDIA_SKIP_VERIFY=1)
[byte[]]$ZeroSig = ,0 * 64
[System.IO.File]::WriteAllBytes($SigPath, $ZeroSig)

Write-Host "Manifest: $ManifestPath" -ForegroundColor Green
Write-Host "Sig (dev stub): $SigPath" -ForegroundColor Green
Write-Host "SHA-256: $Hash"
Write-Host ""
Write-Host "Set this env var to skip Ed25519 verification in dev:" -ForegroundColor Yellow
Write-Host '  $env:GLYX_MEDIA_SKIP_VERIFY = "1"' -ForegroundColor Cyan
Write-Host "Then run: glyx dev"
