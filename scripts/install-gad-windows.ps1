param(
  [Parameter(Mandatory = $true)]
  [string]$Artifact,
  [string]$InstallDir = "$env:LOCALAPPDATA\\Programs\\gad\\bin"
)

$ErrorActionPreference = "Stop"

$artifactPath = [string](Resolve-Path -LiteralPath $Artifact)
$installDir = [System.IO.Path]::GetFullPath($InstallDir)
$targetExe = Join-Path $installDir "gad.exe"
$aliasExe = Join-Path $installDir "get-anything-done.exe"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

function Copy-WithLockRetry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath,
    [int]$MaxAttempts = 80,
    [int]$SleepMs = 250
  )

  $attempt = 0
  while ($attempt -lt $MaxAttempts) {
    $attempt++
    try {
      Copy-Item -Force $SourcePath $DestinationPath -ErrorAction Stop
      return
    } catch {
      $message = $_.Exception.Message
      $isLock = $message -match "being used by another process|cannot access the file"
      if (-not $isLock -or $attempt -ge $MaxAttempts) {
        throw
      }
      if ($attempt -eq 1) {
        Write-Host "File lock detected while updating $DestinationPath; retrying..."
      }
      Start-Sleep -Milliseconds $SleepMs
    }
  }
}

function Test-IsLockError {
  param([Parameter(Mandatory = $true)]$ErrorRecord)
  $message = ""
  try { $message = [string]$ErrorRecord.Exception.Message } catch { $message = [string]$ErrorRecord }
  return $message -match "being used by another process|cannot access the file"
}

function Start-DeferredCopyJob {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string[]]$DestinationPaths,
    [int]$MaxAttempts = 480,
    [int]$SleepMs = 250
  )

  $helperPath = Join-Path ([System.IO.Path]::GetTempPath()) ("gad-install-deferred-{0}.ps1" -f [Guid]::NewGuid().ToString("N"))
  $helperScript = @'
param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,
  [Parameter(Mandatory = $true)]
  [string[]]$DestinationPaths,
  [int]$MaxAttempts = 480,
  [int]$SleepMs = 250
)

$ErrorActionPreference = "Continue"

function Test-LockMessage {
  param([string]$Message)
  return $Message -match "being used by another process|cannot access the file"
}

for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
  $pending = @()
  foreach ($dest in $DestinationPaths) {
    try {
      Copy-Item -Force -LiteralPath $SourcePath -Destination $dest -ErrorAction Stop
    } catch {
      $pending += $dest
    }
  }

  if ($pending.Count -eq 0) { break }
  $DestinationPaths = $pending
  Start-Sleep -Milliseconds $SleepMs
}

try {
  $self = $MyInvocation.MyCommand.Path
  if ($self -and (Test-Path -LiteralPath $self)) {
    Remove-Item -LiteralPath $self -Force -ErrorAction SilentlyContinue
  }
} catch {}
'@

  Set-Content -LiteralPath $helperPath -Value $helperScript -Encoding UTF8
  $argList = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $helperPath,
    '-SourcePath', $SourcePath,
    '-MaxAttempts', [string]$MaxAttempts,
    '-SleepMs', [string]$SleepMs,
    '-DestinationPaths'
  ) + $DestinationPaths
  Start-Process -FilePath 'powershell' -ArgumentList $argList -WindowStyle Hidden | Out-Null
  return $helperPath
}

$destinations = @($targetExe, $aliasExe)
$deferred = $false

foreach ($dest in $destinations) {
  try {
    Copy-WithLockRetry -SourcePath $artifactPath -DestinationPath $dest
  } catch {
    if (Test-IsLockError $_) {
      $deferred = $true
      break
    }
    throw
  }
}

if ($deferred) {
  $helperPath = Start-DeferredCopyJob -SourcePath $artifactPath -DestinationPaths $destinations
  Write-Host "[gad install] install deferred: active gad.exe lock detected."
  Write-Host "[gad install] background retry scheduled via: $helperPath"
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathParts = @()
if ($userPath) {
  $pathParts = $userPath.Split(';') | Where-Object { $_ -and $_.Trim() -ne "" }
}

if ($pathParts -notcontains $installDir) {
  $newPath = if ($userPath -and $userPath.Trim() -ne "") {
    "$userPath;$installDir"
  } else {
    $installDir
  }
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  Write-Host "Updated user PATH: $installDir"
} else {
  Write-Host "User PATH already contains: $installDir"
}

Write-Host ""
if ($deferred) {
  Write-Host "Deferred install targets:"
  Write-Host "  $targetExe"
  Write-Host "  $aliasExe"
} else {
  Write-Host "Installed:"
  Write-Host "  $targetExe"
  Write-Host "  $aliasExe"
}
Write-Host ""
Write-Host "Open a new terminal and run:"
Write-Host "  gad --help"
Write-Host "  gad install all --codex --global"
