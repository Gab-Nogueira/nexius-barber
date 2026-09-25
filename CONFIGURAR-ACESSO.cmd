@echo off
cd /d "%~dp0"
call npm.cmd run db:migrate
if errorlevel 1 goto fim
node scripts/configure-access.mjs
:fim
pause
