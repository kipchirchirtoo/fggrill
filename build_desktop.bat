@echo off
echo [1/4] Building Frontend (Static Export)...
cd frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed!
    exit /b %ERRORLEVEL%
)
cd ..

echo [2/4] Preparing Desktop App Resources...
if not exist "desktop-app\FgGrillPos\wwwroot" mkdir "desktop-app\FgGrillPos\wwwroot"
xcopy /E /I /Y "frontend\out" "desktop-app\FgGrillPos\wwwroot"

echo [3/4] Building C# Application...
dotnet build desktop-app\FgGrillPos\FgGrillPos.csproj

echo [4/4] Running Application...
echo NOTE: If this fails, ensure you have .NET 8 Desktop Runtime installed.
dotnet run --project desktop-app\FgGrillPos\FgGrillPos.csproj
