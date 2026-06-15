@echo off
title Nexus CRM - Iniciando...

:: Verifica se ja esta rodando como Administrador
net session >nul 2>&1
if %ERRORLEVEL% == 0 goto :run

:: Nao e admin — pede elevacao UAC automaticamente
echo  Solicitando permissoes de administrador...
PowerShell -NoProfile -Command ^
  "Start-Process cmd.exe -ArgumentList '/c \"%~f0\"' -Verb RunAs -Wait"
exit /b

:run
:: Agora e admin — executa o script principal
PowerShell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_crm.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERRO ao iniciar o CRM. Verifique as mensagens acima.
    pause
)
