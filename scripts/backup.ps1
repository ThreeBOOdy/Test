param([string]$OutputDirectory = ".\backups")
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$target = Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path "practice-$timestamp.dump"
$containerTarget = "/tmp/practice-$timestamp.dump"
try {
  docker compose -f docker-compose.prod.yml exec -T db pg_dump -U practice -d practice --format=custom --no-owner --no-privileges --file=$containerTarget
  docker compose -f docker-compose.prod.yml cp "db:$containerTarget" $target
} finally {
  docker compose -f docker-compose.prod.yml exec -T db rm -f $containerTarget | Out-Null
}
Write-Output $target
