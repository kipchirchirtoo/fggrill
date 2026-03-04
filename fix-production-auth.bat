@echo off
REM EMERGENCY PRODUCTION AUTH FIX
REM Run this to fix authentication immediately

echo.
echo ========================================
echo   EMERGENCY PRODUCTION AUTH FIX
echo ========================================
echo.
echo This will fix authentication by setting passwords for all users
echo.
set /p confirm="Continue? (y/n): "

if /i not "%confirm%"=="y" (
    echo Cancelled.
    exit /b 1
)

echo.
echo Running fix...
echo.

cd backend
node fix-all-user-passwords.js

echo.
echo ========================================
echo   FIX COMPLETE
echo ========================================
echo.
echo Default password: Allan@13900
echo.
echo Test login now in your browser or with:
echo   curl -X POST https://api.hirall.com/api/auth/login ^
echo     -H "Content-Type: application/json" ^
echo     -d "{\"email\":\"admin@example.com\",\"password\":\"Allan@13900\"}"
echo.
echo WARNING: Notify all users to change their passwords!
echo.
pause
