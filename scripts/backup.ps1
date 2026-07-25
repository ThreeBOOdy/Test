param([string]$OutputDirectory = ".\backups")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path "practice-$timestamp.sql"
$containerTarget = "/tmp/practice-$timestamp.sql"
try {
  $dumpCommand = "exec mysqldump -u practice -p`"`$MYSQL_PASSWORD`" --single-transaction --routines --triggers --set-gtid-purged=OFF practice > $containerTarget"
  docker compose -f docker-compose.prod.yml exec -T db sh -c $dumpCommand
  docker compose -f docker-compose.prod.yml cp "db:$containerTarget" $target
} finally {
  docker compose -f docker-compose.prod.yml exec -T db rm -f $containerTarget | Out-Null
}
Write-Output $target
