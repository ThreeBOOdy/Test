[CmdletBinding()]
param(
  [string]$ComposeFile = "docker-compose.prod.yml",
  [string]$OutputDirectory = ".\certificates"
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$composePath = [System.IO.Path]::GetFullPath((Join-Path $workspace $ComposeFile))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $workspace $OutputDirectory))
$certificatePath = Join-Path $outputPath "caddy-internal-root.crt"

if (-not (Test-Path -LiteralPath $composePath)) {
  throw "Compose file not found: $composePath"
}

New-Item -ItemType Directory -Path $outputPath -Force | Out-Null
docker compose -f $composePath cp proxy:/data/caddy/pki/authorities/local/root.crt $certificatePath
if ($LASTEXITCODE -ne 0) {
  throw "Unable to export the Caddy internal CA certificate"
}

$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($certificatePath)
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
  $sha256Fingerprint = ([BitConverter]::ToString($sha256.ComputeHash($certificate.RawData))).Replace("-", "")
} finally {
  $sha256.Dispose()
}
Write-Output "Certificate: $certificatePath"
Write-Output "Subject: $($certificate.Subject)"
Write-Output "Windows SHA-1 thumbprint: $($certificate.Thumbprint)"
Write-Output "SHA-256 fingerprint: $sha256Fingerprint"
Write-Output "Valid until: $($certificate.NotAfter.ToString('O'))"
