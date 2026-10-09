@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Abriendo el editor local...
start "Editor local de Markdown" cmd /k "cd /d ""%~dp0"" && node editor-local.js"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/editor"
