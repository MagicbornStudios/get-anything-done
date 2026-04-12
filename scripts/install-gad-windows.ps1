param(
  [Parameter(Mandatory = $true)]
  [string]$Artifact,
  [string]$InstallDir = "$env:LOCALAPPDATA\\Programs\\gad\\bin"
)

$ErrorActionPreference = "Stop"

$artifactPath = Resolve-Path $Artifact
$installDir = [System.IO.Path]::GetFullPath($InstallDir)
$targetExe = Join-Path $installDir "gad.exe"
$aliasExe = Join-Path $installDir "get-anything-done.exe"

New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -Force $artifactPath $targetExe
Copy-Item -Force $artifactPath $aliasExe

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
Write-Host "Installed:"
Write-Host "  $targetExe"
Write-Host "  $aliasExe"
Write-Host ""
Write-Host "Open a new terminal and run:"
Write-Host "  gad --help"
Write-Host "  gad install all --codex --global"
