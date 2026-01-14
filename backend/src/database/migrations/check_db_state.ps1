# Database State Checker
$SUPABASE_URL = "https://utsvlihpudfraxzcmtle.supabase.co"
$SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

$headers = @{
    "apikey" = $SUPABASE_SERVICE_KEY
    "Authorization" = "Bearer $SUPABASE_SERVICE_KEY"
    "Content-Type" = "application/json"
}

$rpcUrl = "$SUPABASE_URL/rest/v1/rpc/exec"

Write-Host "🔍 Checking User Roles Enum..." -ForegroundColor Cyan
$query = "SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role') ORDER BY enumlabel;"
$body = @{ query = $query } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $rpcUrl -Method Post -Headers $headers -Body $body -ErrorAction Stop
    foreach ($row in $response) {
        Write-Host " - $($row.enumlabel)" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Error checking roles: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔍 Checking Kitchen Stock Table..." -ForegroundColor Cyan
$query = "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'kitchen_stock');"
$body = @{ query = $query } | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $rpcUrl -Method Post -Headers $headers -Body $body -ErrorAction Stop
    $exists = $response[0].exists
    Write-Host " - Table kitchen_stock exists: $exists" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Error checking tables: $($_.Exception.Message)" -ForegroundColor Red
}
