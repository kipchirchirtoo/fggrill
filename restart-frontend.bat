@echo off
echo Stopping frontend processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq *next dev*" 2>nul

echo Clearing Next.js cache...
cd frontend
if exist .next (
    timeout /t 2 /nobreak >nul
    rmdir /s /q .next 2>nul
    echo Cache cleared
) else (
    echo No cache to clear
)

echo Starting frontend...
start "Frontend Dev Server" cmd /k "npm run dev"

echo Done! Frontend is restarting...
cd ..
