param(
    [switch]$YesLocal
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$MinMajor = 18
$PreferredVersion = "v22.14.0"
$MinPackages = @(
    "typescript@5.8.2",
    "copyfiles@2.4.1",
    "javascript-lp-solver@0.4.24"
)

function Get-NodeMajor([string]$nodeCmd) {
    $verRaw = & $nodeCmd --version
    if ($LASTEXITCODE -ne 0) { return -1 }
    $ver = $verRaw.TrimStart('v')
    $major = [int]($ver.Split('.')[0])
    return $major
}

function Setup-LocalNode() {
    $arch = $env:PROCESSOR_ARCHITECTURE
    $platformArch = if ($arch -match "ARM64") { "arm64" } else { "x64" }

    $downloadDir = Join-Path $PSScriptRoot ".local-node-download"
    $zipPath = Join-Path $downloadDir "node.zip"
    $extractRoot = Join-Path $downloadDir "extract"
    $targetDir = Join-Path $PSScriptRoot ".local-node"

    New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null

    $url = "https://nodejs.org/dist/$PreferredVersion/node-$PreferredVersion-win-$platformArch.zip"
    Write-Host "Downloading Node.js $PreferredVersion ($platformArch)..."
    Invoke-WebRequest -Uri $url -OutFile $zipPath

    if (Test-Path $extractRoot) { Remove-Item -Recurse -Force $extractRoot }
    New-Item -ItemType Directory -Force -Path $extractRoot | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

    $innerDir = Join-Path $extractRoot "node-$PreferredVersion-win-$platformArch"
    if (-not (Test-Path $innerDir)) {
        throw "Unexpected archive layout. Cannot find $innerDir"
    }

    if (Test-Path $targetDir) { Remove-Item -Recurse -Force $targetDir }
    Move-Item -Path $innerDir -Destination $targetDir

    return @{
        Node = (Join-Path $targetDir "node.exe")
        Npm = (Join-Path $targetDir "npm.cmd")
        Source = "local"
    }
}

function Prompt-UseLocalNode([string]$reason) {
    Write-Host "System Node.js unavailable/unusable: $reason" -ForegroundColor Yellow
    if ($YesLocal) {
        $answer = "y"
    } else {
        $answer = Read-Host "Install local Node.js into this folder and continue? (y/N)"
    }
    if ($answer -match '^(y|yes)$') {
        return Setup-LocalNode
    }
    throw "Aborted. Please install Node.js >= $MinMajor globally, or rerun and choose local install."
}

function Resolve-Toolchain() {
    $localNode = Join-Path $PSScriptRoot ".local-node\node.exe"
    $localNpm = Join-Path $PSScriptRoot ".local-node\npm.cmd"
    if ((Test-Path $localNode) -and (Test-Path $localNpm)) {
        $major = Get-NodeMajor $localNode
        if ($major -ge $MinMajor) {
            return @{ Node = $localNode; Npm = $localNpm; Source = "local" }
        }
    }

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($nodeCmd -and $npmCmd) {
        $major = Get-NodeMajor "node"
        if ($major -ge $MinMajor) {
            return @{ Node = "node"; Npm = "npm"; Source = "system" }
        }
        return Prompt-UseLocalNode "Node version $major is lower than required $MinMajor"
    }

    return Prompt-UseLocalNode "node/npm not found in PATH"
}

function Run-Build($tools) {
    Write-Host "Using $($tools.Source) Node.js toolchain"
    & $tools.Npm install --no-save --cache .npm-cache-local $MinPackages
    if ($LASTEXITCODE -ne 0) { return $false }

    & $tools.Npm run build
    if ($LASTEXITCODE -ne 0) { return $false }

    Ensure-DataPlaceholders
    Sync-ResourceConfigToDist

    return $true
}

function Ensure-DataPlaceholders() {
    $rootData = Join-Path $PSScriptRoot "data"
    $distData = Join-Path $PSScriptRoot "dist\data"
    $readmeText = @"
This folder is intentionally empty in the minimal source package.

To use local data mode (resourceBaseUrl = ""), place these files here:
- data.bin
- atlas.webp

Recommended source:
https://github.com/KZdavid/gtnh-calc-data-zh-CN/releases
"@

    New-Item -ItemType Directory -Force -Path $rootData | Out-Null
    New-Item -ItemType Directory -Force -Path $distData | Out-Null
    Set-Content -Path (Join-Path $rootData "README.md") -Value $readmeText -Encoding UTF8
    Set-Content -Path (Join-Path $distData "README.md") -Value $readmeText -Encoding UTF8
}

function Sync-ResourceConfigToDist() {
    $rootConfig = Join-Path $PSScriptRoot "resource.config.js"
    $distConfig = Join-Path $PSScriptRoot "dist\resource.config.js"
    if (Test-Path $rootConfig) {
        Copy-Item -Force $rootConfig $distConfig
    }
}

$tools = Resolve-Toolchain
if (Run-Build $tools) {
    Write-Host "Build succeeded." -ForegroundColor Green
    exit 0
}

if ($tools.Source -eq "system") {
    if ($YesLocal) {
        $answer = "y"
    } else {
        $answer = Read-Host "Build with system Node failed. Retry with local Node install? (y/N)"
    }
    if ($answer -match '^(y|yes)$') {
        $tools = Setup-LocalNode
        if (Run-Build $tools) {
            Write-Host "Build succeeded with local Node." -ForegroundColor Green
            exit 0
        }
    }
}

Write-Host "Build failed. See errors above." -ForegroundColor Red
exit 1
