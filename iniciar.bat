@echo off
setlocal enabledelayedexpansion
title Sistema Padaria

echo.
echo =============================================
echo        SISTEMA DE GESTAO - PADARIA
echo =============================================
echo.
echo Encerrando processos anteriores...

:: Mata qualquer Node.js rodando (backend e frontend antigos)
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Iniciando o sistema, aguarde...
echo.

start "Backend - Padaria" cmd /k "cd /d %~dp0backend && node server.js"
timeout /t 4 /nobreak >nul
start "Frontend - Padaria" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 6 /nobreak >nul

cls
echo.
echo =============================================
echo    SISTEMA INICIADO - PODE USAR AGORA!
echo =============================================
echo.
echo  ** NO COMPUTADOR, abra o navegador e acesse:
echo     http://localhost:5173
echo.
echo  ** NO TABLET OU CELULAR (mesma rede WiFi):

for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "Virtual"') do (
    set "ip=%%A"
    set "ip=!ip: =!"
    echo     http://!ip!:5173
)

echo.
echo  ** LOGIN:
echo     Usuario: gerente   Senha: (a que voce escolheu)
echo     Usuario: atendente Senha: (a que voce escolheu)
echo.
echo =============================================
echo  IMPORTANTE: Nao feche esta janela!
echo  Se fechar, o sistema para de funcionar.
echo =============================================
echo.
pause
