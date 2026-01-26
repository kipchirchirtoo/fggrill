# User Profile Fields Migration Script
$SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
$SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

Write-Host "🚀 Starting User Profile Migration..." -ForegroundColor Cyan

$sqlPath = Join-Path $PSScriptRoot "add_user_profile_fields.sql"
$sqlContent = Get-Content $sqlPath -Raw

$headers = @{
    "apikey" = $SUPABASE_SERVICE_KEY
    "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
    "Content-Type" = "application/json"
}

$body = @{
    query = $sqlContent
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/rpc/exec" -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "✅ Migration executed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Migration failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $details = $reader.ReadToEnd()
        Write-Host "Details: $details" -ForegroundColor Yellow
    }
}
