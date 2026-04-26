$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

Write-Host "Removing local dependencies/tools and build outputs in current folder..."

$targets = @("node_modules", "dist", "release", ".npm-cache-local", ".local-node", ".local-node-download")
foreach ($target in $targets) {
    if (Test-Path $target) {
        Remove-Item -Recurse -Force $target
        Write-Host "Removed $target"
    }
}

Write-Host "Cleanup done."
