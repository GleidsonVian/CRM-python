# Nexus CRM (Clone Bitrix24)

Um CRM leve e poderoso com design inspirado no Bitrix24. Conta com gestão avançada de Kanban, múltiplos pipelines (funis), automação de conversão de Leads para Negócios e configurações dinâmicas de cores e etapas (Slide-over Modal UI).

## 🚀 Como Iniciar o Projeto (Windows)

A maneira mais fácil de iniciar o projeto é através do script automatizado incluído na pasta raiz:

1. Dê um duplo clique no arquivo **`start_crm.bat`**.
2. Duas telas pretas de terminal serão abertas (uma rodando o banco de dados/backend e outra a interface visual). **Não feche estas telas.**
3. Acesse no seu navegador: **http://localhost:5173/**

Para desligar o sistema, basta fechar as duas janelas de terminal abertas pelo script.

### Inicialização Manual (Terminal)

Se preferir rodar manualmente, abra dois terminais distintos na pasta raiz do projeto:

**Terminal 1 (Backend - FastAPI)**
```powershell
cd backend
.\venv\Scripts\Activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 (Frontend - React/Vite)**
```powershell
cd frontend
npm run dev
```

## 🛠️ Tecnologias Utilizadas
- **Frontend:** React, Vite, Vanilla CSS (Design Glassmorphism e Chevron Ribbons).
- **Backend:** Python, FastAPI, SQLAlchemy (SQLite local).

## ✨ Principais Funcionalidades
- **Múltiplos Funis:** Transite facilmente entre Leads e Negócios.
- **Automação de Conversão:** Ao mover um lead para "Convertido (Ganho)", ele é automaticamente enviado para a primeira coluna do funil de Negócios.
- **Customização Visual:** Edite as etapas e pinte-as com as cores do seu negócio usando o color-picker integrado.
- **Detalhamento do Negócio:** Duplo clique no cartão abre um modal deslizante interativo para atualizar o valor da proposta e ler a Timeline de eventos.
- **Etapas de Perda:** Etapas de "Perdido/Desqualificado" para rastreio real.
