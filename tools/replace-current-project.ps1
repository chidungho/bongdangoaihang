$ErrorActionPreference = "Stop"

$newProjectPath = Split-Path -Parent $PSScriptRoot
$rootPath = Split-Path -Parent $newProjectPath
$backupRoot = Join-Path $rootPath ("backup-before-replace-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
$legacyPath = Join-Path $rootPath "legacy-project"

New-Item -Path $backupRoot -ItemType Directory -Force | Out-Null
New-Item -Path $legacyPath -ItemType Directory -Force | Out-Null

$items = Get-ChildItem -LiteralPath $rootPath -Force
foreach ($item in $items) {
  if ($item.FullName -eq $newProjectPath) { continue }
  if ($item.FullName -eq $backupRoot) { continue }
  if ($item.FullName -eq $legacyPath) { continue }
  if ($item.Name -eq "." -or $item.Name -eq "..") { continue }
  $backupTarget = Join-Path $backupRoot $item.Name
  Copy-Item -LiteralPath $item.FullName -Destination $backupTarget -Recurse -Force
  $legacyTarget = Join-Path $legacyPath $item.Name
  Move-Item -LiteralPath $item.FullName -Destination $legacyTarget -Force
}

Write-Host "Backup created at: $backupRoot"
Write-Host "Legacy project moved to: $legacyPath"
Write-Host "Current root now keeps only BongDaNgoaiHang.Com and legacy-project."
