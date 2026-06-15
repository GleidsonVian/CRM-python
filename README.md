# Nexus CRM

CRM completo estilo Bitrix24 — Kanban, Leads, Negócios, Tarefas, Projetos, Automações visuais, RBAC e muito mais.

---

## Início rápido (Windows)

Dê duplo-clique em **`start_crm.bat`** (ou execute `start_crm.ps1` pelo PowerShell).

O script instala as dependências automaticamente na primeira execução e abre o sistema no navegador em **http://localhost:5173**.

Login padrão: `admin@nexus.com` / `admin123`

Para encerrar: feche as duas janelas de terminal abertas pelo script.

### Início manual

**Terminal 1 — Backend**
```powershell
cd backend
.\venv\Scripts\Activate
uvicorn main:app --reload --port 8001
```

**Terminal 2 — Frontend**
```powershell
cd frontend
npm run dev
```

---

## Tecnologias

| Camada | Stack |
|--------|-------|
| Frontend | React 19 + Vite, CSS puro |
| Backend | Python 3, FastAPI, SQLAlchemy |
| Banco | SQLite (`backend/crm.db`) — gerado automaticamente |
| Auth | JWT (stdlib only, sem dependências externas) |

---

## Módulos

### CRM
| Módulo | Descrição |
|--------|-----------|
| **Leads** | Funil exclusivo com entidade `Lead`. Conversão automática para Negócio ao chegar na etapa "Convertido". |
| **Negócios** | Funil `Card` com múltiplos pipelines customizáveis além do padrão. |
| **Contatos** | Cadastro completo (saudação, cargo, empresa, UTM, responsável, foto). |
| **Empresas** | Cadastro de empresas com vínculos a contatos. |

### Kanban
- Drag-and-drop entre etapas
- Vista Kanban e Lista
- Seleção múltipla de cards (bulk actions: mover etapa, atribuir responsável, excluir)
- Filtro por status, etapa, responsável, valor e data
- Campos personalizados exibidos no card
- **Clique do meio** (scroll click) abre o card em nova aba

### Tarefas
- Kanban por prazo: Vencido / Hoje / Esta semana / Próxima semana / Sem prazo / Concluídas
- Vinculação a negócios ou leads (com navegação bidirecional)
- Prioridade, participantes, rastreamento de tempo
- Busca de entidade por nome ou `#ID` com filtro por pipeline/etapa

### Projetos
- Gestão de projetos com tarefas vinculadas
- Membros e permissões por projeto

### Automações
- Flow builder visual (execução esquerda→direita)
- Gatilhos: mudança de etapa
- Ações: Alterar etapa, Mover pipeline, Criar tarefa, Enviar e-mail, Pausa, Webhook
- Condições: if/else com operadores (igual, contém, maior que, etc.)

### Fluxos de trabalho
- Automações visuais executadas **manualmente** em um card
- Mesmo flow builder das automações (modo workflow)
- Contagem de blocos e status ativo/inativo

### Relatórios
- Resumo de negócios por etapa e pipeline
- Evolução temporal de criações

### Auditoria
- Log completo de ações (criar, editar, mover, excluir, login)
- Filtro por tipo de entidade, ação e ator

---

## RBAC — Cargos e Permissões

Sistema de permissões granular por cargo (estilo Bitrix24).

**Permissões por entidade** (Contato, Empresa, Lead, Negócio):
- Ler: `Próprios | Todos | Negar`
- Adicionar / Editar / Excluir / Exportar / Importar
- Extras para Lead/Negócio: Mover etapa, Ver valor (R$), Automações

**Permissões de sistema:**
- Gerenciar funis e etapas
- Gerenciar equipe (usuários)
- Visualizar relatórios
- Configurações do sistema

**Roles padrão seedados:**

| Cargo | Negócios | Leads | Sistema |
|-------|----------|-------|---------|
| Administrador | Todos | Todos | Tudo |
| Gerente | Todos | Todos | Só relatórios |
| Vendedor | Apenas próprios | Apenas próprios | Nada |

O backend filtra `GET /cards` e `GET /leads` automaticamente com base no token JWT do usuário logado.

---

## URL Routing (Hash)

A URL reflete sempre o estado atual para compartilhamento e automações HTTP:

| URL | Estado |
|-----|--------|
| `#pipeline/1` | Pipeline 1 aberto |
| `#pipeline/2/stage/5/deal/42` | Card 42 aberto |
| `#tasks` | Aba de tarefas |
| `#tasks/15` | Tarefa 15 aberta |
| `#contacts` | Contatos |
| `#roles` | Cargos e permissões |

F5 restaura exatamente a view onde o usuário estava.

---

## Estrutura do projeto

```
CRM-python/
├── start_crm.bat              # Atalho Windows
├── start_crm.ps1              # Script de inicialização
├── backend/
│   ├── main.py                # FastAPI — rotas, lógica, migrations inline
│   ├── models.py              # SQLAlchemy — todos os modelos
│   ├── schemas.py             # Pydantic — validação
│   ├── database.py            # Conexão SQLite
│   ├── requirements.txt       # Dependências Python
│   └── crm.db                 # Banco (gerado automaticamente)
└── frontend/
    └── src/
        ├── App.jsx                          # Roteamento hash, estado global, sidebar
        ├── AuthContext.jsx                  # Contexto de autenticação JWT
        └── components/
            ├── KanbanColumn.jsx             # Coluna do Kanban
            ├── KanbanCard.jsx               # Card individual
            ├── CardModal.jsx                # Modal de Negócio/Lead
            ├── LeadModal.jsx                # Modal específico de Lead
            ├── ListView.jsx                 # Vista em lista
            ├── ContactsView.jsx             # Tela de contatos
            ├── CompaniesView.jsx            # Tela de empresas
            ├── UsersView.jsx                # Tela de equipe
            ├── RolesView.jsx                # Cargos e permissões (RBAC)
            ├── TasksKanban.jsx              # Kanban de tarefas por prazo
            ├── TaskModal.jsx                # Modal de tarefa com EntityPicker
            ├── ProjectsView.jsx             # Gestão de projetos
            ├── AutomationsView.jsx          # Tela de automações
            ├── WorkflowsView.jsx            # Fluxos de trabalho manuais
            ├── FlowBuilderModal.jsx         # Editor visual de fluxos
            ├── ReportsView.jsx              # Relatórios
            ├── AuditLogView.jsx             # Log de auditoria
            ├── WebhooksView.jsx             # Gestão de webhooks
            ├── SearchModal.jsx              # Busca global
            ├── NotificationBell.jsx         # Notificações
            ├── CustomFieldsManager.jsx      # Campos personalizados
            ├── ImportLeadsModal.jsx         # Importação CSV de leads
            └── LoginPage.jsx                # Tela de login
```

---

## Portas

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8001 |
| Swagger (docs) | http://localhost:8001/docs |

---

## Migrations

Todas as migrations de banco são aplicadas automaticamente no startup via `_MIGRATIONS` em `main.py` (instruções SQL seguras com `IF NOT EXISTS` / `ADD COLUMN` que ignoram erros se a coluna já existir). Não é necessário rodar nenhum comando de migration manualmente.
