[CmdletBinding(SupportsShouldProcess)]
param(
  [Parameter(Mandatory)]
  [string]$CertificatePath,
  [Parameter(Mandatory)]
  [string]$ExpectedSha256Fingerprint,
  [string]$PreviousCertificatePath,
  [string]$ExpectedPreviousSha256Fingerprint
)

$ErrorActionPreference = "Stop"
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $WhatIfPreference -and -not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script from an elevated PowerShell session"
}

$resolvedCertificatePath = (Resolve-Path -LiteralPath $CertificatePath).Path
$certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($resolvedCertificatePath)
$normalizedExpectedFingerprint = $ExpectedSha256Fingerprint.Replace(":", "").Replace(" ", "").ToUpperInvariant()
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
  $actualSha256Fingerprint = ([BitConverter]::ToString($sha256.ComputeHash($certificate.RawData))).Replace("-", "")
} finally {
  $sha256.Dispose()
}
if ($normalizedExpectedFingerprint -notmatch '^[0-9A-F]{64}$' -or $actualSha256Fingerprint -ne $normalizedExpectedFingerprint) {
  throw "The CA certificate SHA-256 fingerprint does not match the trusted value"
}
$basicConstraints = $certificate.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.19" }
if (-not $basicConstraints) {
  throw "The certificate does not contain CA basic constraints"
}
$caConstraints = [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($basicConstraints, $basicConstraints.Critical)
if (-not $caConstraints.CertificateAuthority -or $certificate.Subject -ne $certificate.Issuer -or $certificate.Subject -notmatch 'Caddy Local Authority' -or $certificate.HasPrivateKey) {
  throw "The certificate must be a self-signed CA root without a private key"
}
if ($certificate.NotBefore -gt (Get-Date) -or $certificate.NotAfter -le (Get-Date)) {
  throw "The CA certificate is not currently valid"
}
$rootStore = "Cert:\LocalMachine\Root"

if ($PSCmdlet.ShouldProcess($rootStore, "Install Caddy internal CA $actualSha256Fingerprint")) {
  Import-Certificate -FilePath $resolvedCertificatePath -CertStoreLocation $rootStore | Out-Null
  $installed = Get-ChildItem -LiteralPath $rootStore | Where-Object Thumbprint -eq $certificate.Thumbprint
  if (-not $installed) {
    throw "The root certificate was not installed"
  }
}

if (($PreviousCertificatePath -and -not $ExpectedPreviousSha256Fingerprint) -or ($ExpectedPreviousSha256Fingerprint -and -not $PreviousCertificatePath)) {
  throw "PreviousCertificatePath and ExpectedPreviousSha256Fingerprint must be provided together"
}
if ($PreviousCertificatePath) {
  $resolvedPreviousPath = (Resolve-Path -LiteralPath $PreviousCertificatePath).Path
  $previousCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($resolvedPreviousPath)
  $previousSha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $actualPreviousFingerprint = ([BitConverter]::ToString($previousSha256.ComputeHash($previousCertificate.RawData))).Replace("-", "")
  } finally {
    $previousSha256.Dispose()
  }
  $normalizedPreviousFingerprint = $ExpectedPreviousSha256Fingerprint.Replace(":", "").Replace(" ", "").ToUpperInvariant()
  if ($actualPreviousFingerprint -ne $normalizedPreviousFingerprint -or $previousCertificate.Subject -notmatch 'Caddy Local Authority') {
    throw "The previous CA certificate does not match the trusted Caddy CA fingerprint"
  }
  $previous = Get-ChildItem -LiteralPath $rootStore | Where-Object Thumbprint -eq $previousCertificate.Thumbprint
  if ($previous -and $PSCmdlet.ShouldProcess($actualPreviousFingerprint, "Remove the verified previous Caddy internal CA certificate")) {
    Remove-Item -LiteralPath $previous.PSPath
  }
}

if ($WhatIfPreference) {
  Write-Output "Validated internal CA root SHA-256: $actualSha256Fingerprint"
} else {
  Write-Output "Installed internal CA root SHA-256: $actualSha256Fingerprint"
}
Write-Output "Restart browsers before testing the HTTPS address."
