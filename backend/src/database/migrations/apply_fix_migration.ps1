$SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
$SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

Write-Host "🚀 Applying Fix Migration for auditor fields..." -ForegroundColor Cyan

# Read the SQL file
$sqlPath = Join-Path $PSScriptRoot "20260207_fix_credit_bills_auditor_fields.sql"
$sqlContent = Get-Content $sqlPath -Raw

# Split SQL into individual statements
$statements = $sqlContent -split ";" | Where-Object { $_.Trim() -ne "" -and -not $_.Trim().StartsWith("--") }

foreach ($i in 0..($statements.Count - 1)) {
    $statement = $statements[$i].Trim() + ";"
    if ($statement.Length -lt 5) { continue }
    
    Write-Host "Executing statement $($i + 1)..." -NoNewline
    
    try {
        $headers = @{
            "apikey" = $SUPABASE_SERVICE_KEY
            "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
            "Content-Type" = "application/json"
        }
        
        $body = @{ query = $statement } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec" -Method Post -Headers $headers -Body $body -ErrorAction Stop
        
        Write-Host " ✅" -ForegroundColor Green
    }
    catch {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host " Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "Done!" -ForegroundColor Green
