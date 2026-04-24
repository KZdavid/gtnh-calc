$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$localNodeDir = Join-Path $PSScriptRoot ".local-node"
$localNodeExe = Join-Path $localNodeDir "node.exe"
$localNpmCmd = Join-Path $localNodeDir "npm.cmd"

if (Test-Path $localNodeExe) {
    $npmCommand = $localNpmCmd
    Write-Host "Using local Node.js from .local-node"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmCommand = "npm"
    Write-Host "Using system Node.js/npm"
} else {
    Write-Host "Node.js not found. Run ./setup-node.ps1 first (recommended, non-global install)." -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/2] Installing dependencies..."
& $npmCommand install --cache .npm-cache-local

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "[2/2] Building project..."
& $npmCommand run build

exit $LASTEXITCODE
