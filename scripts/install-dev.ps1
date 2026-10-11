<#
.SYNOPSIS
    Copy built plugin artifacts to an Obsidian vault for manual testing.
.DESCRIPTION
    Runs a production build then copies main.js, manifest.json, and styles.css
    into the first vault found in Obsidian's own config, or a vault you specify
    with -VaultPath.

    Vault discovery order:
      1. -VaultPath parameter (explicit override)
      2. First vault listed in %APPDATA%\obsidian\obsidian.json  (Windows)
      3. First vault listed in ~/Library/Application Support/obsidian/obsidian.json  (macOS)
      4. First vault listed in ~/.config/obsidian/obsidian.json  (Linux)
#>

param(
    [string]$VaultPath,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$RepoRoot   = $PSScriptRoot | Split-Path -Parent
$PluginId   = (Get-Content (Join-Path $RepoRoot 'manifest.json') | ConvertFrom-Json).id

# -- Resolve vault path -------------------------------------------------------
if (-not $VaultPath) {
    $obsidianJsonCandidates = @(
        (Join-Path $env:APPDATA 'obsidian\obsidian.json'),
        (Join-Path $HOME 'Library\Application Support\obsidian\obsidian.json'),
        (Join-Path $HOME '.config\obsidian\obsidian.json')
    )
    foreach ($candidate in $obsidianJsonCandidates) {
        if (Test-Path $candidate) {
            $vaults = (Get-Content $candidate -Raw | ConvertFrom-Json).vaults
            if ($vaults) {
                $VaultPath = ($vaults.PSObject.Properties | Select-Object -First 1).Value.path
                Write-Host "Discovered vault: $VaultPath" -ForegroundColor Cyan
                break
            }
        }
    }
}

if (-not $VaultPath) {
    Write-Error "Could not discover an Obsidian vault. Pass -VaultPath '<path to your vault>'."
    exit 1
}

$VaultPlugin = Join-Path $VaultPath ".obsidian\plugins\$PluginId"

# -- Build --------------------------------------------------------------------
if (-not $NoBuild) {
    Write-Host "Building..." -ForegroundColor Cyan
    Push-Location $RepoRoot
    npm run build
    Pop-Location
}

# -- Copy artifacts -----------------------------------------------------------
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

Write-Host "Done. Reload Obsidian and enable '$PluginId'." -ForegroundColor Green
