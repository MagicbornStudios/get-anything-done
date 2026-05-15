# scripts/git-hooks/install.ps1
#
# Windows PowerShell installer for the repo-hygiene pre-push hook.
# One-liner: `powershell -ExecutionPolicy Bypass -File scripts/git-hooks/install.ps1`
#
# Mirrors install.sh: resolves $GIT_DIR, backs up any existing hook, then
# copies scripts/git-hooks/pre-push -> .git/hooks/pre-push. Copy (not symlink)
# is used because Windows symlinks require admin / Developer Mode and would
# fail silently on default machines.

$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (& git -C $Here rev-parse --show-toplevel).Trim()
if (-not $RepoRoot) { throw "install.ps1: not inside a git repo." }

$GitDirRel = (& git -C $RepoRoot rev-parse --git-dir).Trim()
if ([System.IO.Path]::IsPathRooted($GitDirRel)) {
    $GitDir = $GitDirRel
} else {
    $GitDir = Join-Path $RepoRoot $GitDirRel
}

$Src = Join-Path $Here 'pre-push'
$DstDir = Join-Path $GitDir 'hooks'
$Dst = Join-Path $DstDir 'pre-push'

if (-not (Test-Path $Src)) {
    throw "install.ps1: source hook not found at $Src"
}

if (-not (Test-Path $DstDir)) {
    New-Item -ItemType Directory -Path $DstDir -Force | Out-Null
}

if ((Test-Path $Dst) -and -not ((Get-Item $Dst).Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    $Ts = [int][double]::Parse((Get-Date -UFormat %s))
    Move-Item $Dst "$Dst.bak-$Ts"
    Write-Host "install.ps1: backed up existing hook to pre-push.bak-$Ts"
}

# Write a tiny POSIX-sh wrapper that exec's the canonical script by absolute
# path. This is safer than Copy on Windows because:
#   1. Git for Windows runs hooks via sh.exe — POSIX wrapper is portable.
#   2. The dispatcher needs pre-push.cjs as a sibling; pointing at the repo
#      path keeps the sibling-lookup correct.
# Forward slashes work in sh on Windows.
$SrcPosix = $Src -replace '\\', '/'
$WrapperContent = "#!/usr/bin/env sh`nexec `"$SrcPosix`" `"`$@`"`n"
Set-Content -Path $Dst -Value $WrapperContent -NoNewline -Encoding ASCII
Write-Host "install.ps1: wrapper $Dst -> $Src"
Write-Host "install.ps1: pre-push hook installed."
