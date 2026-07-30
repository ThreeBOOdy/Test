param(
  [Parameter(Mandatory = $true)][string]$ManifestFile,
  [Parameter(Mandatory = $true)][string]$OfflineDirectory,
  [string]$BackupDirectory = ".\backups",
  [string]$LogFile = ".\logs\backup-operations.jsonl"
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction Stop }
Push-Location $projectRoot
try {
  & $npm.Source exec -- tsx scripts/backup-cli.ts offline-copy --manifest $ManifestFile --backup-root $BackupDirectory --offline-root $OfflineDirectory --log-file $LogFile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
