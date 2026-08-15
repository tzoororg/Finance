# One-time credential setup. Run yourself in a terminal: .\setup-creds.ps1
# Stores each secret DPAPI-encrypted (bound to this Windows user) under creds\.
# Re-run any time to update one institution; blank input keeps the existing value.

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force "$PSScriptRoot\creds" | Out-Null

# field definitions per israeli-bank-scrapers v6
$institutions = [ordered]@{
  leumi    = @('username', 'password')
  hapoalim = @('userCode', 'password')
  max      = @('username', 'password')
  visaCal  = @('username', 'password')
}

foreach ($company in $institutions.Keys) {
  $file = "$PSScriptRoot\creds\$company.json"
  $existing = @{}
  if (Test-Path $file) {
    (Get-Content $file -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $existing[$_.Name] = $_.Value }
  }
  Write-Host "`n=== $company ===" -ForegroundColor Cyan
  $out = [ordered]@{}
  foreach ($field in $institutions[$company]) {
    $prompt = if ($existing.ContainsKey($field)) { "$field (enter = keep current)" } else { $field }
    $sec = Read-Host -AsSecureString $prompt
    $enc = ConvertFrom-SecureString $sec
    # empty SecureString still encrypts; detect emptiness by length
    if ($sec.Length -eq 0 -and $existing.ContainsKey($field)) { $out[$field] = $existing[$field] }
    elseif ($sec.Length -eq 0) { Write-Host "  skipped $company ($field empty)" -ForegroundColor Yellow; $out = $null; break }
    else { $out[$field] = $enc }
  }
  if ($out) { $out | ConvertTo-Json | Set-Content $file -Encoding utf8; Write-Host "  saved creds\$company.json" -ForegroundColor Green }
}
Write-Host "`nDone. Test with: node sync.mjs --company leumi --show" -ForegroundColor Cyan
