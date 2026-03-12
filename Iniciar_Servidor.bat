@echo off
color 0A
echo =======================================================
echo          Iniciando Servidor Arcano Solutions
echo               Full Stack IA & Proxy Bidi
echo =======================================================
echo.
echo Este servidor maneja tanto el Frontend como el
echo Proxy de Inteligencia Artificial (WebSocket).
echo.
echo URL de acceso: http://localhost:8080
echo.

:: Verificar si Node.js está instalado
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado. Por favor instala Node.js para continuar.
    pause
    exit
)

:: Instalar dependencias si falta node_modules
if not exist "node_modules\" (
    echo Instalando dependencias necesarias...
    npm install
)

:: Iniciar el servidor
node server.js

pause
