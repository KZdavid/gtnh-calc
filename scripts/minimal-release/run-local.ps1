$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$localNode = Join-Path $PSScriptRoot ".local-node\node.exe"
if (Test-Path $localNode) {
    $node = $localNode
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
    $node = "node"
} else {
    Write-Host "Node.js not found. Run ./install.ps1 first." -ForegroundColor Yellow
    exit 1
}

& $node "scripts/minimal-release/serve-dist.cjs"
