# PowerShell script to fix the stock-out page
$filePath = "frontend/src/app/dashboard/branch-store/stock-out/page.tsx"
$content = Get-Content $filePath -Raw

# Replace the problematic code with error-handled version
$oldPattern = @"
  const \{ user \} = useAuth\(\);
  // console\.log\('\[BranchStockOutPage\] UserRole\.AUDITOR:', UserRole\.AUDITOR, 'User Role:', user\?\.role\);
  const searchParams = useSearchParams\(\);
  const branchId = useMemo\(\(\) => \{
    const id = searchParams\.get\('branch_id'\);
    return id \? parseInt\(id\) : \(user\?\.branch_id \|\| undefined\);
  \}, \[searchParams, user\?\.branch_id\]\);
"@

$newCode = @"
  const { user } = useAuth();
  const searchParams = useSearchParams();
  
  const branchId = useMemo(() => {
    try {
      const id = searchParams?.get('branch_id');
      return id ? parseInt(id) : (user?.branch_id || undefined);
    } catch (error) {
      console.error('Error reading search params:', error);
      return user?.branch_id || undefined;
    }
  }, [searchParams, user?.branch_id]);
"@

$content = $content -replace [regex]::Escape($oldPattern), $newCode

Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Fixed stock-out page successfully!"
