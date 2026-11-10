$ErrorActionPreference = 'Stop'

if (-not $env:ADMIN_TOKEN) {
  $randomBytes = New-Object byte[] 32
  $randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomGenerator.GetBytes($randomBytes)
  } finally {
    $randomGenerator.Dispose()
  }
  $env:ADMIN_TOKEN = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  Write-Host "Generated a temporary admin token for this server session: $env:ADMIN_TOKEN" -ForegroundColor Yellow
}

if (-not $env:HOST) {
  $env:HOST = '127.0.0.1'
}

Write-Host "Starting Magenta Computers at http://127.0.0.1:3000"
Write-Host "Keep this terminal open while using the store and admin pages."
npm start
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
