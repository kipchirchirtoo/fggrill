@echo off
set "PATH=C:\Users\Administrator\AppData\Local\ms-playwright-go\1.50.1;%PATH%"

cd backend
echo Building Backend...
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
echo Backend Build Successful!
