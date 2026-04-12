@echo off
echo ========================================
echo Testing Attendance PDF Data Fetch
echo ========================================
echo.

REM Test the Python service endpoint
echo Testing Python service health...
curl -s http://localhost:5001/health
echo.
echo.

echo Testing attendance data fetch...
echo (This will show if the service is returning data)
echo.

REM Create a test request (you'll need to adjust branch_id and dates)
curl -X POST http://localhost:5001/api/reports/generate/branded-pdf ^
  -H "Content-Type: application/json" ^
  -d "{\"reportType\":\"employee_attendance\",\"filters\":{\"branch_id\":1,\"start_date\":\"2026-04-11\",\"end_date\":\"2026-04-11\"},\"useRealData\":true}" ^
  --output test-attendance.pdf

echo.
echo.
if exist test-attendance.pdf (
    echo ✅ PDF generated successfully: test-attendance.pdf
    echo Open the file to verify it contains data
) else (
    echo ❌ PDF generation failed
    echo Check python-services/server.log for errors
)

echo.
echo Press any key to exit...
pause >nul
