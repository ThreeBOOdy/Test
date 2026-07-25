param([Parameter(Mandatory = $true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
$resolved = (Resolve-Path -LiteralPath $BackupFile).Path
$containerSource = "/tmp/practice-restore.sql"
docker compose -f docker-compose.prod.yml stop app
try {
  docker compose -f docker-compose.prod.yml cp $resolved "db:$containerSource"
  docker compose -f docker-compose.prod.yml exec -T db sh -c 'exec mysql -u practice -p"$MYSQL_PASSWORD" practice < /tmp/practice-restore.sql'
} finally {
  docker compose -f docker-compose.prod.yml exec -T db rm -f $containerSource | Out-Null
  docker compose -f docker-compose.prod.yml start app
}
