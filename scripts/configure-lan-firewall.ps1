[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [System.Net.IPAddress]$ServerIp,
  [Parameter(Mandatory)]
  [string[]]$AllowedRemoteAddress,
  [string]$EvidencePath = ".\test-results\lan-acceptance\firewall-audit.json",
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

function Test-PrivateIPv4([System.Net.IPAddress]$Address) {
  $bytes = $Address.GetAddressBytes()
  if ($bytes.Length -ne 4) {
    return $false
  }
  return ($bytes[0] -eq 10) -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
}

function ConvertTo-PrivateCidr([string]$Cidr) {
  if ($Cidr -notmatch '^([^/]+)/(\d{1,2})$') {
    throw "AllowedRemoteAddress must contain only private IPv4 CIDRs"
  }
  $network = $null
  if (-not [System.Net.IPAddress]::TryParse($Matches[1], [ref]$network)) {
    throw "AllowedRemoteAddress must contain only private IPv4 CIDRs"
  }
  $prefix = [int]$Matches[2]
  if ($prefix -lt 8 -or $prefix -gt 32 -or -not (Test-PrivateIPv4 $network)) {
    throw "AllowedRemoteAddress must contain only private IPv4 CIDRs"
  }
  $networkBytes = $network.GetAddressBytes()
  $maskBytes = for ($index = 0; $index -lt 4; $index++) {
    $remainingBits = $prefix - ($index * 8)
    if ($remainingBits -ge 8) { 255 }
    elseif ($remainingBits -le 0) { 0 }
    else { 256 - [math]::Pow(2, 8 - $remainingBits) }
  }
  for ($index = 0; $index -lt 4; $index++) {
    if (($networkBytes[$index] -band $maskBytes[$index]) -ne $networkBytes[$index]) {
      throw "AllowedRemoteAddress CIDRs must use network addresses"
    }
  }
  $lastAddressBytes = for ($index = 0; $index -lt 4; $index++) { $networkBytes[$index] -bor (255 - $maskBytes[$index]) }
  if (-not (Test-PrivateIPv4 ([System.Net.IPAddress]::new($lastAddressBytes)))) {
    throw "AllowedRemoteAddress must contain only private IPv4 CIDRs"
  }
  return [pscustomobject]@{ Value = $Cidr; NetworkBytes = $networkBytes; MaskBytes = $maskBytes }
}

function Test-IPv4InCidr([System.Net.IPAddress]$Address, [pscustomobject]$Cidr) {
  $addressBytes = $Address.GetAddressBytes()
  for ($index = 0; $index -lt 4; $index++) {
    if (($addressBytes[$index] -band $Cidr.MaskBytes[$index]) -ne $Cidr.NetworkBytes[$index]) {
      return $false
    }
  }
  return $true
}

if (-not (Test-PrivateIPv4 $ServerIp)) {
  throw "ServerIp must be a private IPv4 address"
}
$validatedCidrs = @($AllowedRemoteAddress | ForEach-Object { ConvertTo-PrivateCidr $_ })
if (-not ($validatedCidrs | Where-Object { Test-IPv4InCidr $ServerIp $_ })) {
  throw "ServerIp must belong to AllowedRemoteAddress"
}

if ($ValidateOnly) {
  Write-Output "Validated firewall boundary: $ServerIp for $($validatedCidrs.Value -join ', ')"
  return
}

$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $WhatIfPreference -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script from an elevated PowerShell session"
}

$profiles = Get-NetFirewallProfile
if ($profiles | Where-Object { -not $_.Enabled }) {
  throw "Every Windows Firewall profile must be enabled"
}
if ($profiles | Where-Object DefaultInboundAction -ne "Block") {
  throw "Every Windows Firewall profile must use DefaultInboundAction=Block"
}

$group = "Radio Practice LAN"
if ($PSCmdlet.ShouldProcess($group, "Replace application firewall rules")) {
  Get-NetFirewallRule -Group $group -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule -DisplayName "Radio Practice HTTPS from approved LAN" -Group $group -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $ServerIp.IPAddressToString -LocalPort 443 -RemoteAddress $validatedCidrs.Value -Profile Any | Out-Null
  New-NetFirewallRule -DisplayName "Radio Practice HTTP redirect from approved LAN" -Group $group -Direction Inbound -Action Allow -Protocol TCP -LocalAddress $ServerIp.IPAddressToString -LocalPort 80 -RemoteAddress $validatedCidrs.Value -Profile Any | Out-Null
  New-NetFirewallRule -DisplayName "Radio Practice deny MySQL ingress" -Group $group -Direction Inbound -Action Block -Protocol TCP -LocalPort 3306 -RemoteAddress Any -Profile Any | Out-Null

  $createdRules = @(Get-NetFirewallRule -Group $group)
  if ($createdRules.Count -ne 3 -or $createdRules | Where-Object { -not $_.Enabled }) {
    throw "The expected enabled firewall rules were not created"
  }
  $httpsRule = $createdRules | Where-Object DisplayName -eq "Radio Practice HTTPS from approved LAN"
  $httpRule = $createdRules | Where-Object DisplayName -eq "Radio Practice HTTP redirect from approved LAN"
  $mysqlRule = $createdRules | Where-Object DisplayName -eq "Radio Practice deny MySQL ingress"
  $httpsPort = $httpsRule | Get-NetFirewallPortFilter
  $httpPort = $httpRule | Get-NetFirewallPortFilter
  $mysqlPort = $mysqlRule | Get-NetFirewallPortFilter
  $httpsAddress = $httpsRule | Get-NetFirewallAddressFilter
  $httpAddress = $httpRule | Get-NetFirewallAddressFilter
  $expectedRemoteAddresses = @($validatedCidrs.Value | Sort-Object)
  $actualHttpsRemoteAddresses = @($httpsAddress.RemoteAddress | Sort-Object)
  $actualHttpRemoteAddresses = @($httpAddress.RemoteAddress | Sort-Object)
  if ($httpsRule.Action -ne "Allow" -or $httpsPort.LocalPort -ne "443" -or @($httpsAddress.LocalAddress) -notcontains $ServerIp.IPAddressToString -or ($actualHttpsRemoteAddresses -join ",") -ne ($expectedRemoteAddresses -join ",")) {
    throw "The HTTPS firewall rule does not match the approved LAN boundary"
  }
  if ($httpRule.Action -ne "Allow" -or $httpPort.LocalPort -ne "80" -or @($httpAddress.LocalAddress) -notcontains $ServerIp.IPAddressToString -or ($actualHttpRemoteAddresses -join ",") -ne ($expectedRemoteAddresses -join ",")) {
    throw "The HTTP firewall rule does not match the approved LAN boundary"
  }
  if ($mysqlRule.Action -ne "Block" -or $mysqlPort.LocalPort -ne "3306") {
    throw "The MySQL deny rule was not created correctly"
  }

  $resolvedEvidencePath = [System.IO.Path]::GetFullPath($EvidencePath)
  New-Item -ItemType Directory -Path (Split-Path -Parent $resolvedEvidencePath) -Force | Out-Null
  [pscustomobject]@{
    schemaVersion = 1
    checkedAt = (Get-Date).ToUniversalTime().ToString("O")
    serverIp = $ServerIp.IPAddressToString
    allowedRemoteAddresses = @($validatedCidrs.Value)
    profiles = @($profiles | ForEach-Object { [pscustomobject]@{ name = $_.Name; enabled = [bool]$_.Enabled; defaultInboundAction = $_.DefaultInboundAction.ToString() } })
    rules = @(
      [pscustomobject]@{ name = $httpsRule.DisplayName; action = $httpsRule.Action.ToString(); localPort = $httpsPort.LocalPort; localAddress = @($httpsAddress.LocalAddress); remoteAddress = @($httpsAddress.RemoteAddress) }
      [pscustomobject]@{ name = $httpRule.DisplayName; action = $httpRule.Action.ToString(); localPort = $httpPort.LocalPort; localAddress = @($httpAddress.LocalAddress); remoteAddress = @($httpAddress.RemoteAddress) }
      [pscustomobject]@{ name = $mysqlRule.DisplayName; action = $mysqlRule.Action.ToString(); localPort = $mysqlPort.LocalPort; localAddress = @("Any"); remoteAddress = @("Any") }
    )
  } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $resolvedEvidencePath -Encoding UTF8
  $evidenceSha256 = (Get-FileHash -LiteralPath $resolvedEvidencePath -Algorithm SHA256).Hash
  Write-Output "Firewall evidence: $resolvedEvidencePath"
  Write-Output "Firewall evidence SHA-256: $evidenceSha256"
}

Write-Output "Allowed $($validatedCidrs.Value -join ', ') to $ServerIp on TCP 80/443."
Write-Output "TCP 3306 is explicitly blocked; all other inbound traffic relies on the default block policy."
