@echo off

echo Iniciando Backend...
start "Backend - Atelier" cmd /k "cd /d C:\ATELIER\atelier_v3_chat_banco && set SPRING_PROFILES_ACTIVE=postgres && set DB_URL=jdbc:postgresql://localhost:5432/atelier && set DB_USERNAME=postgres && set DB_PASSWORD=epilef && mvn spring-boot:run"

echo Iniciando Frontend...
start "Frontend - Atelier" cmd /k "cd /d C:\ATELIER\atelier_v3_chat_banco\frontend && npm run dev"

echo.
echo Backend e Frontend iniciados.
pause