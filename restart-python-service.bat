@echo off
echo ========================================
echo Restarting Python Service on Port 5001
echo ========================================
echo.

echo Step 1: Finding and stopping existing service...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001') do (
    echo Found process: %%a
    taskkill /PID %%a /F 2>nul
)

echo.
echo Step 2: Waiting for port to be released...
timeout /t 2 /nobreak >nul

echo.
echo Step 3: Starting Python service...
cd python-services
start "Python Service - Port 5001" python app.py

echo.
echo ========================================
echo Service restart initiated!
echo ========================================
echo.
echo A new window should open with the Python service.
echo Look for: "Running on http://0.0.0.0:5001"
echo.
echo After the service starts:
echo 1. Go to your browser (localhost:3001)
echo 2. Press Ctrl+Shift+R to hard refresh
echo 3. Try exporting the security report again
echo.
pause
