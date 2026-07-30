param(
  [string]$BackupDirectory = ".\backups",
  [int]$Daily = 14,
  [int]$Weekly = 8,
  [int]$Monthly = 12,
  [string]$LogFile = ".\logs\backup-operations.jsonl"
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction Stop }
Push-Location $projectRoot
try {
  & $npm.Source exec -- tsx scripts/backup-cli.ts cleanup --backup-root $BackupDirectory --daily $Daily --weekly $Weekly --monthly $Monthly --log-file $LogFile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
