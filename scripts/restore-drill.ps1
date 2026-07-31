param(
  [Parameter(Mandatory = $true)][string]$ManifestFile,
  [Parameter(Mandatory = $true)][string]$IsolationRoot,
  [Parameter(Mandatory = $true)][string]$ComposeFile,
  [Parameter(Mandatory = $true)][string]$ComposeProject,
  [Parameter(Mandatory = $true)][string]$DatabaseName,
  [string]$BackupDirectory = ".\backups",
  [string]$LogFile = ".\logs\backup-operations.jsonl",
  [string]$DrillLogFile = ".\logs\restore-drills.jsonl"
)
$ErrorActionPreference = "Stop"
if ($env:BACKUP_RESTORE_ISOLATED -ne "true" -or $env:BACKUP_RESTORE_ENVIRONMENT -ne "isolated" -or -not $env:BACKUP_RESTORE_TARGET_ID) {
  throw "Set BACKUP_RESTORE_ISOLATED=true, BACKUP_RESTORE_ENVIRONMENT=isolated, and BACKUP_RESTORE_TARGET_ID before running a restore drill."
}
$projectRoot = Split-Path -Parent $PSScriptRoot
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { $npm = Get-Command npm -ErrorAction Stop }
Push-Location $projectRoot
try {
  & $npm.Source exec -- tsx scripts/backup-cli.ts restore-drill --manifest $ManifestFile --backup-root $BackupDirectory --isolation-root $IsolationRoot --compose-file $ComposeFile --compose-project $ComposeProject --database-name $DatabaseName --log-file $LogFile --drill-log-file $DrillLogFile
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
