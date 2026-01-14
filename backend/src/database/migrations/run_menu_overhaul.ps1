# Menu Overhaul - Migration Script for PowerShell
$SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
$SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

Write-Host "Starting Menu Overhaul migration..." -ForegroundColor Cyan

# Read the SQL file
$sqlPath = Join-Path $PSScriptRoot "20260114_menu_overhaul.sql"
$sqlContent = Get-Content $sqlPath -Raw

Write-Host "SQL file loaded: $sqlPath" -ForegroundColor Green

# Use Supabase REST API to execute SQL
# Trying exec_sql instead of exec
$headers = @{
    "apikey" = $SUPABASE_SERVICE_KEY
    "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
    "Content-Type" = "application/json"
}

$body = @{
    sql_query = $sqlContent
} | ConvertTo-Json

try {
    Write-Host "Attempting exec_sql RPC..."
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec_sql" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Migration completed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "exec_sql failed, trying exec..." -ForegroundColor Yellow
    
    $bodyExec = @{
        query = $sqlContent
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec" -Method Post -Headers $headers -Body $bodyExec -ErrorAction Stop
        Write-Host "Migration completed successfully via exec!" -ForegroundColor Green
    }
    catch {
        Write-Host "Migration failed both exec_sql and exec:" -ForegroundColor Red
        Write-Host $_.Exception.Message
        if ($_.ErrorDetails) {
            Write-Host $_.ErrorDetails.Message
        }
    }
}
