# Build script that captures output for error analysis
Write-Host "=== Step 1: npm install ===" -ForegroundColor Cyan
npm install 2>&1 | Tee-Object -FilePath "build-output.txt"

Write-Host "`n=== Step 2: TypeScript Check ===" -ForegroundColor Cyan
npx tsc --noEmit 2>&1 | Tee-Object -FilePath "build-output.txt" -Append

Write-Host "`n=== Step 3: npm build ===" -ForegroundColor Cyan
npm run build 2>&1 | Tee-Object -FilePath "build-output.txt" -Append

Write-Host "`n=== Build complete. Check build-output.txt for details ===" -ForegroundColor Green

