@echo off
chcp 65001 >nul
setlocal

set PROJECT_DIR=%~dp0
set BUNDLE_DIR=%PROJECT_DIR%src-tauri\target\release\bundle
set OUTPUT_DIR=%PROJECT_DIR%release-output

echo ============================================
echo   VMS Deploy Tools — Build Release
echo ============================================
echo.

:: Check node
node --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Node.js chua duoc cai dat. Tai tai: https://nodejs.org
    pause & exit /b 1
)

:: Check cargo
cargo --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Rust/Cargo chua duoc cai dat. Tai tai: https://rustup.rs
    pause & exit /b 1
)

cd /d "%PROJECT_DIR%"

echo [1/3] Cai dat npm dependencies...
call npm install
if errorlevel 1 (
    echo [FAIL] npm install that bai.
    pause & exit /b 1
)

echo.
echo [2/3] Build release (Vite + Rust + Bundle)...
echo       Qua trinh nay mat 5-15 phut lan dau...
echo.
call npm run tauri build
if errorlevel 1 (
    echo [FAIL] Build that bai. Xem log o tren.
    pause & exit /b 1
)

echo.
echo [3/3] Sao chep file ra thu muc output...
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

:: Copy .msi
for /r "%BUNDLE_DIR%\msi" %%f in (*.msi) do (
    copy "%%f" "%OUTPUT_DIR%\" >nul
    echo   [OK] %%~nxf
)

:: Copy .exe (NSIS installer)
for /r "%BUNDLE_DIR%\nsis" %%f in (*.exe) do (
    copy "%%f" "%OUTPUT_DIR%\" >nul
    echo   [OK] %%~nxf
)

echo.
echo ============================================
echo   BUILD THANH CONG!
echo   File tai: %OUTPUT_DIR%
echo ============================================
echo.

:: Mo thu muc output
explorer "%OUTPUT_DIR%"
pause
