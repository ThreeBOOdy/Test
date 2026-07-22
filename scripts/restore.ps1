param([Parameter(Mandatory = $true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path -LiteralPath $BackupFile).Path
$containerSource = "/tmp/practice-restore.dump"
docker compose -f docker-compose.prod.yml stop app
try {
  docker compose -f docker-compose.prod.yml cp $resolved "db:$containerSource"
  docker compose -f docker-compose.prod.yml exec -T db pg_restore -U practice -d practice --clean --if-exists --no-owner --no-privileges $containerSource
} finally {
  docker compose -f docker-compose.prod.yml exec -T db rm -f $containerSource | Out-Null
  docker compose -f docker-compose.prod.yml start app
}
