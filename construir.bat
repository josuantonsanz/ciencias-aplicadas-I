@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo  Construyendo el material de clase...
echo ============================================
node build.js
echo.
pause
