@echo off
set "PATH=C:\Users\Administrator\AppData\Local\ms-playwright-go\1.50.1;%PATH%"

cd frontend
if exist .next (
    echo Cleaning .next cache...
    rmdir /s /q .next
)

echo Building Frontend...
call node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run build
