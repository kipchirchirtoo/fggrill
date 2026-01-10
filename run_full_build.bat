@echo off
set "PATH=C:\Users\Administrator\AppData\Local\ms-playwright-go\1.50.1;%PATH%"

echo ==========================================
echo Building Frontend...
echo ==========================================
cd frontend
call node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo Frontend install failed
    exit /b %ERRORLEVEL%
)

call node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed
    exit /b %ERRORLEVEL%
)

echo ==========================================
echo Building Backend...
echo ==========================================
cd ..\backend
call node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install
if %ERRORLEVEL% NEQ 0 (
    echo Backend install failed
    exit /b %ERRORLEVEL%
)

call node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
if %ERRORLEVEL% NEQ 0 (
    echo Backend build failed
    exit /b %ERRORLEVEL%
)

echo All builds successful!
