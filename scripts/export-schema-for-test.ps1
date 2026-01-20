# Export schema from production database for test database setup
# Usage: pwsh ./scripts/export-schema-for-test.ps1

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Exporting Schema for Test Database" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Load environment variables from .env.local
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Host "Error: .env.local file not found" -ForegroundColor Red
    Write-Host "Please create .env.local with your production DATABASE_URL"
    exit 1
}

$dbUrl = $null
if ($env:USE_SUPABASE -eq "true" -and $env:DATABASE_URL_SUPABASE) {
    $dbUrl = $env:DATABASE_URL_SUPABASE
} elseif ($env:DATABASE_URL) {
    $dbUrl = $env:DATABASE_URL
} else {
    Write-Host "Error: DATABASE_URL or DATABASE_URL_SUPABASE not set in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "Using database: $($dbUrl.Substring(0, [Math]::Min(50, $dbUrl.Length)))..." -ForegroundColor Yellow

# Create output directory
$outputDir = "supabase-migration/test"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Check if pg_dump is available
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpPath) {
    Write-Host "Error: pg_dump not found. Please install PostgreSQL client tools." -ForegroundColor Red
    Write-Host "Download from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

# Export schema only (no data)
Write-Host "Exporting schema..." -ForegroundColor Green
& pg_dump $dbUrl `
    --schema-only `
    --no-owner `
    --no-acl `
    --file="$outputDir/01-schema-only.sql"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to export schema" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Schema exported successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files created:" -ForegroundColor Yellow
Write-Host "  - $outputDir/01-schema-only.sql"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Create a new Supabase project for testing"
Write-Host "2. Copy the contents of 01-schema-only.sql"
Write-Host "3. Paste into Supabase SQL Editor and run"
Write-Host "4. Update .env.test with your test database connection string"
Write-Host ""


