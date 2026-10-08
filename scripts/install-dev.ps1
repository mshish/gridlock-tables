<#
.SYNOPSIS
    Copy built plugin artifacts to the dev vault for manual testing.
.DESCRIPTION
    Runs a production build then copies main.js, manifest.json, and styles.css
    to the Obsidian dev vault plugin folder.
    Vault: D:\Obsidian\Personal\.obsidian\plugins\gridlock-tables\
#>

param(
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'

$RepoRoot    = $PSScriptRoot | Split-Path -Parent
$VaultPlugin = "D:\Obsidian\Personal\.obsidian\plugins\gridlock-tables"

if (-not $NoBuild) {
    Write-Host "Building..." -ForegroundColor Cyan
    Push-Location $RepoRoot
    npm run build
    Pop-Location
}

if (-not (Test-Path $VaultPlugin)) {
    New-Item -ItemType Directory -Path $VaultPlugin -Force | Out-Null
    Write-Host "Created $VaultPlugin" -ForegroundColor Yellow
}

$artifacts = @('main.js', 'manifest.json', 'styles.css')
foreach ($f in $artifacts) {
    $src = Join-Path $RepoRoot $f
    if (Test-Path $src) {
        Copy-Item $src $VaultPlugin -Force
        Write-Host "Copied $f" -ForegroundColor Green
    }
}

Write-Host "Done. Reload Obsidian and enable Gridlock Tables." -ForegroundColor Green
