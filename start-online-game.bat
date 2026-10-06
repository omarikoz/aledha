@echo off
title Aledha Online Multiplayer Game Host
echo ===================================================
echo   Starting Aledha Game Server + Cloudflare Tunnel
echo ===================================================
echo.
cd /d "%~dp0"
npm run host
pause
