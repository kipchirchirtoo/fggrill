@echo off
echo Stopping all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo.
echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:3001
echo ========================================
echo.
echo Press any key to close this window...
pause >nul
