# Nexus CRM

CRM completo estilo Bitrix24 — Kanban, Leads, Negócios, Tarefas, Projetos, Automações visuais, RBAC e muito mais.

---

## Formas de rodar

### Opção 1 — Docker (recomendado)

> Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e **em execução** (ícone da baleia na barra de tarefas).

**Passo 1 — Clone ou abra a pasta do projeto no terminal**

```powershell
cd C:\Users\Gleidson\pasta4\Python\CRM
```

**Passo 2 — Suba tudo com um comando**

```powershell
docker-compose up --build
```

Aguarde até ver as duas mensagens abaixo (primeira vez leva ~3 minutos):

```
backend   | INFO:     Uvicorn running on http://0.0.0.0:8001
frontend  | ...start worker process
```

**Passo 3 — Acesse no navegador**

| O que | URL |
|---|---|
| Sistema | http://localhost |
| API (Swagger) | http://localhost:8001/docs |
| Health check | http://localhost:8001/health |

**Login padrão:** `admin@nexus.com` / `admin123`

---

#### Comandos Docker úteis

```powershell
# Subir em background (libera o terminal)
docker-compose up -d

# Ver logs em tempo real
docker-compose logs -f

# Ver logs só do backend
docker-compose logs -f backend

# Parar tudo
docker-compose down

# Reconstruir as imagens (após mudanças no código)
docker-compose up --build
```

> **Atenção:** O banco de dados (`crm.db`) e os uploads ficam salvos na pasta `backend/` do seu computador — eles **não são apagados** ao parar os containers.

---

### Opção 2 — Desenvolvimento local (sem Docker)

Use quando quiser fazer alterações no código com **hot reload**.

**Pré-requisitos:** Python 3.10+ e Node.js 18+ instalados.

**Opção rápida (Windows):** dê duplo-clique em `start_crm.bat` — ele instala tudo automaticamente na primeira vez e abre o sistema no navegador.

**Manual:**

```powershell
# Terminal 1 — Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

```powershell
# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Acesse **http://localhost:5173**

---

## Configuração

### Backend — `backend/.env`

Copie o arquivo de exemplo e ajuste os valores:

```powershell
copy backend\.env.example backend\.env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./crm.db` | Caminho do banco |
| `JWT_SECRET` | `nexus-crm-dev-secret-change-in-prod` | **Troque em produção** |
| `ADMIN_EMAIL` | `admin@nexus.com` | E-mail do admin criado no primeiro acesso |
| `ADMIN_PASSWORD` | `admin123` | **Troque em produção** |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Origens permitidas (separadas por vírgula) |

Para gerar um `JWT_SECRET` seguro:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend — `frontend/.env`

```powershell
copy frontend\.env.example frontend\.env
```

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8001` | URL do backend |

---

## Deploy em produção (VPS)

1. Copie a pasta do projeto para o servidor
2. Crie os arquivos `.env` com valores de produção
3. Suba passando a URL real do backend:

```bash
VITE_API_URL=https://api.seudominio.com docker-compose up --build -d
```

---

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | React 19 + Vite, CSS puro |
| Backend | Python 3, FastAPI, SQLAlchemy |
| Banco | SQLite (`backend/crm.db`) — gerado automaticamente |
| Auth | JWT (stdlib, sem dependências externas) |
| Container | Docker + nginx |

---

## Módulos

### CRM
| Módulo | Descrição |
|---|---|
| **Leads** | Funil exclusivo com entidade Lead. Conversão automática para Negócio. |
| **Negócios** | Funil Card com múltiplos pipelines customizáveis. |
| **Contatos** | Cadastro completo (saudação, cargo, empresa, UTM, responsável, foto). |
| **Empresas** | Cadastro de empresas com vínculos a contatos. |

### Kanban
- Drag-and-drop entre etapas
- Vista Kanban e Lista
- Seleção múltipla de cards (bulk actions)
- Filtro por status, etapa, responsável, valor e data
- Campos personalizados exibidos no card
- **Clique do meio** abre o card em nova aba

### Tarefas
- Kanban por prazo: Vencido / Hoje / Esta semana / Próxima semana / Sem prazo / Concluídas
- Vinculação a negócios ou leads
- Prioridade, participantes, rastreamento de tempo

### Projetos
- Gestão de projetos com tarefas vinculadas
- Membros e permissões por projeto

### Automações
- Flow builder visual (execução esquerda→direita)
- Gatilhos: mudança de etapa
- Ações: Alterar etapa, Criar tarefa, Enviar e-mail, Pausa, Webhook
- Condições: if/else com operadores (igual, contém, maior que, etc.)

### Relatórios
- Resumo de negócios por etapa e pipeline
- Evolução temporal de criações

### Auditoria
- Log completo de ações (criar, editar, mover, excluir, login)
- Filtro por tipo de entidade, ação e ator

---

## RBAC — Cargos e Permissões

Sistema de permissões granular por cargo.

**Permissões por entidade** (Contato, Empresa, Lead, Negócio):
- Ler: `Próprios | Todos | Negar`
- Adicionar / Editar / Excluir / Exportar / Importar

**Roles padrão:**

| Cargo | Negócios | Leads | Sistema |
|---|---|---|---|
| Administrador | Todos | Todos | Tudo |
| Gerente | Todos | Todos | Só relatórios |
| Vendedor | Apenas próprios | Apenas próprios | Nada |

---

## URL Routing (Hash)

| URL | Estado |
|---|---|
| `#pipeline/1` | Pipeline 1 aberto |
| `#pipeline/2/stage/5/deal/42` | Card 42 aberto |
| `#tasks` | Aba de tarefas |
| `#contacts` | Contatos |
| `#roles` | Cargos e permissões |

F5 restaura exatamente a view onde o usuário estava.

---

## Estrutura do projeto

```
CRM/
├── docker-compose.yml
├── start_crm.bat              # Atalho Windows (modo desenvolvimento)
├── start_crm.ps1
│
├── backend/
│   ├── main.py                # FastAPI app + startup seed
│   ├── models.py              # SQLAlchemy — todos os modelos
│   ├── schemas.py             # Pydantic — validação
│   ├── database.py            # Conexão com o banco
│   ├── config.py              # Lê variáveis do .env
│   ├── limiter.py             # Rate limiter (slowapi)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example           # Copie para .env
│   ├── alembic/               # Migrations de banco
│   ├── routers/               # Um arquivo por recurso (cards, leads, auth…)
│   ├── services/              # Lógica de negócio (auth, automações, permissões…)
│   ├── tests/                 # pytest — 74 testes
│   └── crm.db                 # Banco SQLite (gerado no primeiro run)
│
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── .env.example           # Copie para .env
    └── src/
        ├── App.jsx
        ├── AuthContext.jsx
        ├── config.js          # API_URL via variável de ambiente
        ├── hooks/
        │   └── useAPI.js      # Hook fetch com auth automático
        └── components/        # ~30 componentes React
```

---

## Portas

| Serviço | Desenvolvimento | Docker |
|---|---|---|
| Frontend | http://localhost:5173 | http://localhost |
| Backend API | http://localhost:8001 | http://localhost:8001 |
| Swagger | http://localhost:8001/docs | http://localhost:8001/docs |
| Health check | http://localhost:8001/health | http://localhost:8001/health |

---

## Testes

```powershell
cd backend
.\venv\Scripts\pytest.exe tests/ -v
```

74 testes cobrindo: autenticação JWT, RBAC, engine de automações, endpoints HTTP (cards, leads, contatos, pipelines, automações).
