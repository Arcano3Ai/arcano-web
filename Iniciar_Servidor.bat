@echo off
color 0A
echo =======================================================
echo          Iniciando Servidor Local de Pruebas
echo               Para Arcano Solutions Live API
echo =======================================================
echo.
echo Para que el microfono funcione correctamente en el
echo navegador, es necesario usar un servidor local
echo en lugar de abrir el archivo haciendo doble click.
echo.
echo Abriendo servidor local en http://localhost:8000
echo.

:: Intenta primero con python 3
python -m http.server 8000
if %errorlevel% neq 0 (
    echo.
    echo Buscando alternativas, intentando con node...
    npx serve . -p 8000
)

pause
