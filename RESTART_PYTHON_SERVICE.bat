@echo off
echo ========================================
echo Restarting Python Service on Port 5001
echo ========================================
echo.

REM Find and kill the process on port 5001
echo [1/3] Stopping existing Python service...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 ^| findstr LISTENING') do (
    echo Killing process ID: %%a
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

REM Navigate to python-services directory
cd python-services

REM Start the service using Python directly
echo [2/3] Starting Python service...
start /B python app.py

REM Wait for service to start
echo [3/3] Waiting for service to initialize...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo Python Service Restarted Successfully!
echo ========================================
echo.
echo Service URL: http://localhost:5001
echo Health Check: http://localhost:5001/health
echo.
echo Press any key to exit...
pause >nul
