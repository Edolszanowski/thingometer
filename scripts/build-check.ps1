# Build check script - captures errors to a file for quick debugging
$ErrorActionPreference = "Continue"
$outputFile = "build-output.txt"

Write-Host "Running TypeScript check..." -ForegroundColor Cyan
npx tsc --noEmit 2>&1 | Out-File -FilePath $outputFile -Encoding utf8

$content = Get-Content $outputFile -Raw
if ($content -and $content.Trim()) {
    Write-Host "TypeScript errors found! Check build-output.txt" -ForegroundColor Red
    exit 1
} else {
    Write-Host "TypeScript check passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Running Next.js build..." -ForegroundColor Cyan
    npm run build 2>&1 | Out-File -FilePath $outputFile -Encoding utf8
    
    $content = Get-Content $outputFile -Raw
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed! Check build-output.txt" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "Build succeeded!" -ForegroundColor Green
        exit 0
    }
}

