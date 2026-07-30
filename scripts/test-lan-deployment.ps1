#requires -Version 7.0

[CmdletBinding()]
param(
  [Parameter(Mandatory, ParameterSetName = "Lan")]
  [System.Net.IPAddress]$ServerIp,
  [Parameter(ParameterSetName = "Lan")]
  [ValidateSet("Authorized", "Unauthorized")]
  [string]$ExpectedAccess = "Authorized",
  [Parameter(ParameterSetName = "Lan")]
  [string]$FirewallEvidencePath,
  [Parameter(ParameterSetName = "Lan")]
  [string]$ExpectedFirewallEvidenceSha256,
  [Parameter(Mandatory, ParameterSetName = "Public")]
  [System.Net.IPAddress]$PublicTarget,
  [Parameter(Mandatory, ParameterSetName = "Public")]
  [string]$PublicBoundaryRecordPath,
  [Parameter(Mandatory, ParameterSetName = "Public")]
  [string]$ExpectedPublicBoundaryRecordSha256,
  [Parameter(ParameterSetName = "Public")]
  [string]$ConnectivityControlHost = "1.1.1.1",
  [Parameter(ParameterSetName = "Public")]
  [int]$ConnectivityControlPort = 443,
  [string]$OutputDirectory = ".\test-results\lan-acceptance"
)

$ErrorActionPreference = "Stop"
$workspace = Split-Path -Parent $PSScriptRoot
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $workspace $OutputDirectory))
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

$results = [System.Collections.Generic.List[object]]::new()

function Add-Result([string]$Name, [bool]$Passed, [string]$Detail) {
  $results.Add([pscustomobject]@{ name = $Name; passed = $Passed; detail = $Detail })
}

function Test-TcpPort([string]$Target, [int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync($Target, $Port)
    return $task.Wait(3000) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-GloballyRoutablePublicIPv4([System.Net.IPAddress]$Address) {
  $bytes = $Address.GetAddressBytes()
  if ($bytes.Length -ne 4) {
    return $false
  }
  return -not (
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
  )
}

function Test-PinnedFile([string]$Path, [string]$ExpectedSha256) {
  if (-not $Path -or -not $ExpectedSha256 -or -not (Test-Path -LiteralPath $Path)) {
    return $false
  }
  $normalizedExpected = $ExpectedSha256.Replace(":", "").Replace(" ", "").ToUpperInvariant()
  return $normalizedExpected -match '^[0-9A-F]{64}$' -and (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -eq $normalizedExpected
}

function Test-RecentTimestamp([string]$Value, [TimeSpan]$MaximumAge) {
  $timestamp = [DateTimeOffset]::MinValue
  if (-not [DateTimeOffset]::TryParse($Value, [ref]$timestamp)) {
    return $false
  }
  $now = [DateTimeOffset]::UtcNow
  return $timestamp -le $now.AddMinutes(5) -and $timestamp -ge $now.Subtract($MaximumAge)
}

function Test-FirewallEvidence([string]$Path, [string]$ExpectedSha256, [string]$ExpectedServerIp) {
  if (-not (Test-PinnedFile $Path $ExpectedSha256)) {
    return $false
  }
  try {
    $evidence = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    $profilesAreSafe = @($evidence.profiles).Count -gt 0 -and -not (@($evidence.profiles) | Where-Object { -not $_.enabled -or $_.defaultInboundAction -ne "Block" })
    $rules = @($evidence.rules)
    $approvedRemoteAddresses = @($evidence.allowedRemoteAddresses | Sort-Object)
    $httpsRule = $rules | Where-Object { $_.name -eq "Radio Practice HTTPS from approved LAN" -and $_.action -eq "Allow" -and $_.localPort -eq "443" -and @($_.localAddress) -contains $ExpectedServerIp -and (@($_.remoteAddress | Sort-Object) -join ",") -eq ($approvedRemoteAddresses -join ",") }
    $httpRule = $rules | Where-Object { $_.name -eq "Radio Practice HTTP redirect from approved LAN" -and $_.action -eq "Allow" -and $_.localPort -eq "80" -and @($_.localAddress) -contains $ExpectedServerIp -and (@($_.remoteAddress | Sort-Object) -join ",") -eq ($approvedRemoteAddresses -join ",") }
    $mysqlRule = $rules | Where-Object { $_.name -eq "Radio Practice deny MySQL ingress" -and $_.action -eq "Block" -and $_.localPort -eq "3306" -and @($_.localAddress) -contains "Any" -and @($_.remoteAddress) -contains "Any" }
    return $evidence.schemaVersion -eq 1 -and $evidence.serverIp -eq $ExpectedServerIp -and (Test-RecentTimestamp $evidence.checkedAt ([TimeSpan]::FromHours(24))) -and $approvedRemoteAddresses.Count -gt 0 -and -not ($approvedRemoteAddresses | Where-Object { $_ -eq "Any" -or $_ -eq "0.0.0.0/0" }) -and $profilesAreSafe -and $httpsRule -and $httpRule -and $mysqlRule
  } catch {
    return $false
  }
}

function Test-PublicBoundaryRecord([string]$Path, [string]$ExpectedSha256, [string]$ExpectedTarget) {
  if (-not (Test-PinnedFile $Path $ExpectedSha256)) {
    return $false
  }
  try {
    $record = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    return $record.schemaVersion -eq 1 -and $record.publicTarget -eq $ExpectedTarget -and $record.owner -and $record.changeReference -and (Test-RecentTimestamp $record.checkedAt ([TimeSpan]::FromDays(30)) )
  } catch {
    return $false
  }
}

if ($PSCmdlet.ParameterSetName -eq "Public") {
  if (-not (Test-GloballyRoutablePublicIPv4 $PublicTarget)) {
    throw "PublicTarget must be a globally routable public IPv4 address"
  }
  if (-not (Test-PublicBoundaryRecord $PublicBoundaryRecordPath $ExpectedPublicBoundaryRecordSha256 $PublicTarget.IPAddressToString)) {
    throw "The public boundary target does not match a current pinned network record"
  }
  if (-not (Test-TcpPort $ConnectivityControlHost $ConnectivityControlPort)) {
    throw "The external test device cannot reach the connectivity control endpoint"
  }
  foreach ($port in 80, 443, 3306) {
    $connected = Test-TcpPort $PublicTarget.IPAddressToString $port
    Add-Result "Public TCP $port is unreachable" (-not $connected) $(if ($connected) { "$($PublicTarget.IPAddressToString) accepted TCP $port" } else { "$($PublicTarget.IPAddressToString) did not accept TCP $port" })
  }
} else {
  $httpsBase = "https://$($ServerIp.IPAddressToString)"
  $httpBase = "http://$($ServerIp.IPAddressToString)"
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  if ($ExpectedAccess -eq "Unauthorized") {
    $handler.ServerCertificateCustomValidationCallback = { $true }
  }
  $client = [System.Net.Http.HttpClient]::new($handler)
  $client.Timeout = [TimeSpan]::FromSeconds(5)
  try {
    try {
      $httpResponse = $client.GetAsync("$httpBase/api/health/live").GetAwaiter().GetResult()
      $expectedHttpStatus = if ($ExpectedAccess -eq "Authorized") { 308 } else { 403 }
      Add-Result "HTTP policy" ([int]$httpResponse.StatusCode -eq $expectedHttpStatus) "Expected $expectedHttpStatus, received $([int]$httpResponse.StatusCode)"
    } catch {
      $hasFirewallEvidence = $ExpectedAccess -eq "Unauthorized" -and (Test-FirewallEvidence $FirewallEvidencePath $ExpectedFirewallEvidenceSha256 $ServerIp.IPAddressToString)
      Add-Result "HTTP policy" $hasFirewallEvidence "Connection failed: $($_.Exception.Message); firewall evidence: $FirewallEvidencePath"
    }

    try {
      $httpsResponse = $client.GetAsync("$httpsBase/api/health/ready").GetAwaiter().GetResult()
      $expectedHttpsStatus = if ($ExpectedAccess -eq "Authorized") { 200 } else { 403 }
      $trustDetail = if ($ExpectedAccess -eq "Authorized") { "TLS validation used the Windows trust store" } else { "TLS trust was bypassed only to verify the network rejection response" }
      Add-Result "HTTPS access and certificate trust" ([int]$httpsResponse.StatusCode -eq $expectedHttpsStatus) "Expected $expectedHttpsStatus, received $([int]$httpsResponse.StatusCode); $trustDetail"
    } catch {
      $hasFirewallEvidence = $ExpectedAccess -eq "Unauthorized" -and (Test-FirewallEvidence $FirewallEvidencePath $ExpectedFirewallEvidenceSha256 $ServerIp.IPAddressToString)
      Add-Result "HTTPS access and certificate trust" $hasFirewallEvidence "Connection failed: $($_.Exception.Message); firewall evidence: $FirewallEvidencePath"
    }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }

  $connected = Test-TcpPort $ServerIp.IPAddressToString 3306
  Add-Result "MySQL is not exposed" (-not $connected) $(if ($connected) { "TCP 3306 accepted a connection" } else { "TCP 3306 is unreachable" })
}

$mode = if ($PSCmdlet.ParameterSetName -eq "Public") { "Public" } else { $ExpectedAccess }
$target = if ($PSCmdlet.ParameterSetName -eq "Public") { $PublicTarget.IPAddressToString } else { $ServerIp.IPAddressToString }
$record = [pscustomobject]@{
  checkedAt = (Get-Date).ToUniversalTime().ToString("O")
  device = $env:COMPUTERNAME
  sourceAddresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object IPAddress -notlike "127.*" | Select-Object -ExpandProperty IPAddress)
  target = $target
  expectedAccess = $mode
  passed = -not ($results | Where-Object passed -eq $false)
  results = $results
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$recordPath = Join-Path $outputPath "lan-acceptance-$($mode.ToLowerInvariant())-$timestamp.json"
$record | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $recordPath -Encoding UTF8
$results | Format-Table -AutoSize
Write-Output "Acceptance record: $recordPath"

if (-not $record.passed) {
  exit 1
}
