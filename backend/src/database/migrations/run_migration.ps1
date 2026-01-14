# Kitchen Management Module - Migration Script for PowerShell
# This script runs the SQL migration using Supabase REST API

$SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
$SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

Write-Host "🚀 Starting Kitchen Management Module migration..." -ForegroundColor Cyan
Write-Host ""

# Read the SQL file
$sqlPath = Join-Path $PSScriptRoot "20260114_kitchen_management.sql"
$sqlContent = Get-Content $sqlPath -Raw

Write-Host "📝 SQL file loaded: $sqlPath" -ForegroundColor Green
Write-Host "📊 File size: $($sqlContent.Length) characters" -ForegroundColor Green
Write-Host ""

# Split SQL into individual statements
$statements = $sqlContent -split ";" | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("--") }

Write-Host "Found $($statements.Count) SQL statements" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$errorCount = 0
$errors = @()

foreach ($i in 0..($statements.Count - 1)) {
    $statement = $statements[$i].Trim() + ";"
    
    # Skip comments and empty statements
    if ($statement.StartsWith("--") -or $statement.StartsWith("/*") -or $statement.Length -lt 10) {
        continue
    }
    
    Write-Host "Executing statement $($i + 1)/$($statements.Count)..." -NoNewline
    
    try {
        # Use Supabase REST API to execute SQL
        $headers = @{
            "apikey" = $SUPABASE_SERVICE_KEY
            "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
            "Content-Type" = "application/json"
        }
        
        $body = @{
            query = $statement
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Host " ✅" -ForegroundColor Green
        $successCount++
    }
    catch {
        Write-Host " ❌" -ForegroundColor Red
        $errorCount++
        $errors += "Statement $($i + 1): $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "✅ Migration completed!" -ForegroundColor Green
Write-Host "   Successful: $successCount" -ForegroundColor Green
Write-Host "   Errors: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host "=" * 80 -ForegroundColor Cyan

if ($errorCount -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Errors encountered:" -ForegroundColor Yellow
    foreach ($error in $errors) {
        Write-Host "   - $error" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 Note: Some errors may be expected (e.g., 'already exists' errors)" -ForegroundColor Yellow
    Write-Host "Please run the SQL manually in Supabase SQL Editor if needed:" -ForegroundColor Yellow
    Write-Host "https://supabase.com/dashboard/project/utsvlihpudfraxzcmtle/sql/new" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Verify tables were created in Supabase dashboard" -ForegroundColor White
Write-Host "2. Test API endpoints" -ForegroundColor White
Write-Host "3. Access Kitchen Operations at /dashboard/kitchen-operations" -ForegroundColor White
