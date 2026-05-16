@echo off
echo.
echo =============================================
echo     RESETAR SENHAS - SISTEMA PADARIA
echo =============================================
echo.
echo ATENCAO: Isso vai apagar SOMENTE as senhas
echo e recriar os usuarios padrao.
echo Os produtos, vendas e clientes NAO sao apagados.
echo.
set /p confirm="Tem certeza? Digite SIM para continuar: "
if /i "%confirm%" neq "SIM" (
    echo Cancelado.
    pause
    exit
)

echo.
echo Parando o sistema...
taskkill /fi "WINDOWTITLE eq Backend - Padaria" /f >nul 2>&1
timeout /t 2 /nobreak >nul

echo Resetando senhas...
node "%~dp0backend\scripts\resetar-senhas.js"

echo.
echo Pronto! Senhas resetadas:
echo   gerente   / 1234
echo   atendente / 1234
echo.
echo Agora abra o iniciar.bat normalmente.
pause
