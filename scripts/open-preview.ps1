param([int]$Port = 4174, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$siteUrl = "http://127.0.0.1:$Port/"

function Get-PreviewResponse {
  try { return Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 2 }
  catch { return $null }
}

$response = Get-PreviewResponse
if ($response -and $response.Content -notmatch 'ANKA') {
  throw "Port $Port is already serving a different site. Stop it and try again."
}
if (-not $response) {
  $npmCommand = Get-Command npm.cmd -ErrorAction Stop
  Start-Process -FilePath $npmCommand.Source -ArgumentList @('run', 'dev', '--', '--host', '127.0.0.1', '--port', "$Port", '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null
  for ($attempt = 0; $attempt -lt 30 -and -not $response; $attempt++) {
    Start-Sleep -Milliseconds 500
    $response = Get-PreviewResponse
  }
}
if (-not $response -or $response.Content -notmatch 'ANKA') {
  throw "The ANKA preview did not start at $siteUrl. Run npm run dev in the project folder to see the error."
}
Write-Host "ANKA preview: $siteUrl"
if (-not $NoBrowser) { Start-Process $siteUrl }
