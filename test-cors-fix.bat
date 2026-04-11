@echo off
echo Testing CORS Fix for Security Report
echo =====================================
echo.

echo Step 1: Testing OPTIONS preflight request...
curl -X OPTIONS http://localhost:5001/api/reports/generate/security-report ^
  -H "Origin: http://localhost:3001" ^
  -H "Access-Control-Request-Method: POST" ^
  -H "Access-Control-Request-Headers: Content-Type" ^
  -v

echo.
echo.
echo Step 2: Testing POST request with sample data...
curl -X POST http://localhost:5001/api/reports/generate/security-report ^
  -H "Content-Type: application/json" ^
  -H "Origin: http://localhost:3001" ^
  -d "{\"date_range\":\"Test\",\"summary\":{},\"threat_analysis\":{},\"geographic_distribution\":[],\"logs\":[]}" ^
  --output test-report.pdf ^
  -v

echo.
echo.
if exist test-report.pdf (
  echo SUCCESS: PDF generated successfully!
  echo File saved as: test-report.pdf
  del test-report.pdf
) else (
  echo FAILED: PDF was not generated
)

echo.
echo Test complete. Check the output above for any errors.
pause
