@echo off
echo [1/4] Building Frontend...
cd frontend
if exist ".next" rmdir /s /q ".next"
if exist "out" rmdir /s /q "out"
call npm run build
cd ..

echo [2/4] Copying Assets...
if not exist "desktop-app\FgGrillPos\wwwroot" mkdir "desktop-app\FgGrillPos\wwwroot"
xcopy /E /I /Y "frontend\out" "desktop-app\FgGrillPos\wwwroot"

echo [3/4] Publishing Standalone Windows App...
echo This may take a minute...
dotnet publish desktop-app\FgGrillPos\FgGrillPos.csproj -c Release -r win-x64 --self-contained true -o dist

echo.
echo [4/4] DONE! 
echo.
echo Your app is ready in the "dist" folder.
echo You can copy the "dist" folder to any Windows computer and run 'FgGrillPos.exe'.
echo.
pause
explorer dist
