[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [System.Net.IPAddress]$PublicTarget,
  [Parameter(Mandatory)]
  [string]$Owner,
  [Parameter(Mandatory)]
  [string]$ChangeReference,
  [string]$OutputPath = ".\test-results\lan-acceptance\public-boundary.json"
)

$ErrorActionPreference = "Stop"
$bytes = $PublicTarget.GetAddressBytes()
if (
  $bytes.Length -ne 4 -or
  $bytes[0] -eq 0 -or
  $bytes[0] -eq 10 -or
  ($bytes[0] -eq 100 -and $bytes[1] -ge 64 -and $bytes[1] -le 127) -or
  $bytes[0] -eq 127 -or
  ($bytes[0] -eq 169 -and $bytes[1] -eq 254) -or
  ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
  ($bytes[0] -eq 192 -and $bytes[1] -eq 0 -and ($bytes[2] -eq 0 -or $bytes[2] -eq 2)) -or
  ($bytes[0] -eq 192 -and $bytes[1] -eq 168) -or
  ($bytes[0] -eq 198 -and ($bytes[1] -eq 18 -or $bytes[1] -eq 19 -or ($bytes[1] -eq 51 -and $bytes[2] -eq 100))) -or
  ($bytes[0] -eq 203 -and $bytes[1] -eq 0 -and $bytes[2] -eq 113) -or
  $bytes[0] -ge 224
) {
  throw "PublicTarget must be a globally routable public IPv4 address"
}

$resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
New-Item -ItemType Directory -Path (Split-Path -Parent $resolvedOutputPath) -Force | Out-Null
[pscustomobject]@{
  schemaVersion = 1
  checkedAt = (Get-Date).ToUniversalTime().ToString("O")
  publicTarget = $PublicTarget.IPAddressToString
  owner = $Owner
  changeReference = $ChangeReference
} | ConvertTo-Json | Set-Content -LiteralPath $resolvedOutputPath -Encoding UTF8

$sha256 = (Get-FileHash -LiteralPath $resolvedOutputPath -Algorithm SHA256).Hash
Write-Output "Public boundary record: $resolvedOutputPath"
Write-Output "Public boundary record SHA-256: $sha256"
