$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDirectory = Join-Path $projectRoot "server"
$envPath = Join-Path $serverDirectory ".env"

if (Test-Path $envPath) {
  Write-Output "server\.env already exists. It was not changed."
  Write-Output "If you need to replace the Atlas connection, back up the file and run this setup again after removing it."
  exit 1
}

$secureUri = Read-Host "Paste the MongoDB Atlas URI or the Atlas command containing it (input is hidden)" -AsSecureString
$bstr = [IntPtr]::Zero
try {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
  $mongoUri = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
} finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
  $secureUri.Dispose()
}

$uriStart = $mongoUri.IndexOf("mongodb+srv://", [StringComparison]::OrdinalIgnoreCase)
if ($uriStart -lt 0) {
  throw "No mongodb+srv URI found. In Atlas, choose Connect > Drivers > Node.js and copy its connection string."
}

$mongoUri = ($mongoUri.Substring($uriStart) -split '\s', 2 | Select-Object -First 1).Trim([char[]]@('"', "'"))
if ($mongoUri -match '[\r\n]') {
  throw "The Atlas URI is incomplete. Copy the full connection string from Connect > Drivers > Node.js."
}

$hasUsernamePlaceholder = $mongoUri.Contains("<db_username>")
$hasPasswordPlaceholder = $mongoUri.Contains("<db_password>")
if ($hasUsernamePlaceholder -ne $hasPasswordPlaceholder) {
  throw "The Atlas URI must contain both <db_username> and <db_password>, or neither."
}

if ($hasUsernamePlaceholder) {
  $databaseUsername = Read-Host "Database username (for example shopez_app)"
  if ([string]::IsNullOrWhiteSpace($databaseUsername)) {
    throw "A database username is required."
  }

  $securePassword = Read-Host "Database password (input is hidden)" -AsSecureString
  $passwordPointer = [IntPtr]::Zero
  try {
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $databasePassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  } finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    $securePassword.Dispose()
  }

  if ([string]::IsNullOrEmpty($databasePassword)) {
    throw "A database password is required."
  }

  $mongoUri = $mongoUri.Replace(
    "<db_username>",
    [uri]::EscapeDataString($databaseUsername.Trim())
  ).Replace(
    "<db_password>",
    [uri]::EscapeDataString($databasePassword)
  )
}

$uriMatch = [regex]::Match(
  $mongoUri,
  '^(mongodb\+srv://[^/?#]+)(/[^?#]*)?(\?[^#]*)?$'
)
if (-not $uriMatch.Success) {
  throw "Could not read the Atlas URI. Copy the complete mongodb+srv connection string, including its query string."
}

$hostAndCredentials = $uriMatch.Groups[1].Value
$databasePath = $uriMatch.Groups[2].Value
$query = $uriMatch.Groups[3].Value
if ([string]::IsNullOrWhiteSpace($databasePath) -or $databasePath -eq "/") {
  $databasePath = "/shopez"
}

$randomBytes = New-Object byte[] 48
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $generator.GetBytes($randomBytes)
} finally {
  $generator.Dispose()
}
$jwtSecret = [Convert]::ToBase64String($randomBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
[Array]::Clear($randomBytes, 0, $randomBytes.Length)

$lines = @(
  "PORT=8000"
  "MONGO_URI=$hostAndCredentials$databasePath$query"
  "JWT_SECRET=$jwtSecret"
  "CLIENT_ORIGIN=http://localhost:8080"
)

Set-Content -LiteralPath $envPath -Value $lines -Encoding UTF8
Write-Output "Atlas connection and a fresh JWT secret were saved to server\.env."
Write-Output "The connection string was not displayed. Start ShopEZ with start-shopez.bat."
