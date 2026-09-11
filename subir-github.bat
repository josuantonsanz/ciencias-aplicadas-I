@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo  Construyendo y subiendo los cambios a GitHub...
echo ============================================
node build.js
if errorlevel 1 goto :error

for /f "delims=" %%A in ('git status --porcelain') do set "HAY_CAMBIOS=1"
if not defined HAY_CAMBIOS (
  echo.
  echo No hay cambios para subir.
  goto :fin
)

echo.
git status --short
echo.
set /p "MENSAJE=Mensaje del commit (Enter para usar uno automático): "
if not defined MENSAJE set "MENSAJE=Actualiza el material de clase"

git add -A
git commit -m "%MENSAJE%"
if errorlevel 1 goto :error

git pull --rebase origin main
if errorlevel 1 goto :error

git push origin main
if errorlevel 1 goto :error

echo.
echo Cambios subidos correctamente a GitHub.
goto :fin

:error
echo.
echo Se ha producido un error. Revisa el mensaje anterior.

:fin
echo.
pause
