@echo off
echo Iniciando Nexus CRM...

echo Iniciando Backend (FastAPI)...
start cmd /k "cd backend && .\venv\Scripts\uvicorn main:app --reload --port 8000"

echo Iniciando Frontend (Vite/React)...
start cmd /k "cd frontend && npm run dev"

echo Os servidores foram abertos em duas novas janelas!
echo Para acessar o CRM, abra: http://localhost:5173/
echo Para desligar o sistema, basta fechar as duas janelinhas pretas do terminal.
