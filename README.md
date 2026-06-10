# Nexus CRM

CRM leve com Kanban, dois funis pré-definidos e automação de conversão de Leads em Negócios.

---

## Início rápido (Windows)

Dê duplo-clique em **`start_crm.bat`** (ou execute `start_crm.ps1` pelo PowerShell).

O script instala as dependências automaticamente na primeira execução e abre o sistema no navegador em **http://localhost:5173**.

Para encerrar: feche as duas janelas de terminal abertas pelo script.

### Início manual

**Terminal 1 — Backend**
```powershell
cd backend
.\venv\Scripts\Activate
uvicorn main:app --reload --port 8000
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
| Frontend | React + Vite, CSS puro |
| Backend | Python, FastAPI, SQLAlchemy |
| Banco | SQLite (arquivo `backend/crm.db`) |

---

## Arquitetura dos Funis

O sistema possui dois funis pré-definidos, criados automaticamente a cada novo banco de dados.

### Funil de Leads
Entidade própria (`Lead`) com endpoints exclusivos (`/leads`). **Única** — não é possível criar mais de um funil de Leads. Acessível pela sidebar diretamente.

| Etapa padrão | Tipo | Cor |
|---|---|---|
| Não atribuído | Normal | Ciano |
| Em andamento | Normal | Ciano |
| Processado | Normal | Ciano |
| Lead descartado | Perda | Vermelho |
| Lead convertido | Ganho → cria Negócio | Verde |

### Funil de Negócios
Entidade `Card` com endpoints exclusivos (`/cards`). **Única** — não é possível criar mais de um funil de Negócios. Acessível pela sidebar diretamente.

| Etapa padrão | Tipo | Cor |
|---|---|---|
| Em Desenvolvimento | Normal | Azul |
| Criar documentos | Normal | Roxo |
| Fatura | Normal | Amarelo |
| Em andamento | Normal | Ciano |
| Fatura final | Normal | Laranja |
| Negócios Fechados | Ganho | Verde |
| Negócios Perdidos | Perda | Vermelho |
| Analisar falha | Perda | Vermelho escuro |

---

## Fluxo de conversão Lead → Negócio

Quando um Lead é arrastado para a etapa **"Lead convertido"** no Funil de Leads (ou clica em ⚡ no modal):

1. O lead é movido para a etapa.
2. `POST /leads/{id}/convert` é chamado automaticamente.
3. Um novo Card é criado na **primeira etapa do Funil de Negócios**, copiando título, valor, contatos e responsáveis do lead.
4. O lead recebe o flag `converted = true` e referência ao Card gerado (`converted_card_id`).
5. O card do lead exibe o badge **"✓ Convertido"** no Kanban.

O botão **⚡ Converter** no modal do lead também aciona o mesmo fluxo manualmente.

---

## Funcionalidades

- **Dois módulos fixos** — Leads e Negócios são entidades únicas, separadas na sidebar, não podem ser duplicadas nem excluídas
- **Conversão automática** — ao atingir "Convertido (Ganho)", o lead vira um Negócio automaticamente
- **Kanban drag-and-drop** — mova cards entre etapas arrastando
- **Vista em lista** — alternativa tabular ao Kanban
- **Modal de detalhes** — edição inline de título, valor, etapa, contatos, responsáveis e descrição
- **Timeline de atividades** — histórico automático de movimentações, mudanças de valor, contatos e notas manuais
- **Campos personalizados** — crie campos extras do tipo texto, número, seleção, data, checkbox, moeda, etc.
- **Automações** — regras com flow builder visual (webhook, atribuir responsável, nota automática, alterar valor/campo)
- **Contatos** — cadastro completo estilo Bitrix24 (saudação, nome do meio, cargo, empresa, website, messenger, tipo, fonte, UTM, responsável, observadores, foto)
- **Múltiplos funis customizáveis** — além dos dois padrão, crie funis adicionais
- **Etapas configuráveis** — renomeie, recolora e adicione etapas em qualquer funil

---

## Estrutura do projeto

```
CRM-python/
├── start_crm.bat          # Atalho para iniciar (Windows)
├── start_crm.ps1          # Script principal de inicialização
├── backend/
│   ├── main.py            # FastAPI — rotas e lógica de negócio
│   ├── models.py          # SQLAlchemy — modelos do banco
│   ├── schemas.py         # Pydantic — validação de dados
│   ├── database.py        # Conexão SQLite
│   ├── requirements.txt   # Dependências Python
│   └── crm.db             # Banco de dados (gerado automaticamente)
└── frontend/
    └── src/
        ├── App.jsx                        # Roteamento e estado global
        └── components/
            ├── KanbanColumn.jsx           # Coluna do Kanban
            ├── KanbanCard.jsx             # Card individual
            ├── CardModal.jsx              # Modal de Lead e Negócio
            ├── ContactsView.jsx           # Tela de contatos
            ├── UsersView.jsx              # Tela de equipe
            ├── AutomationsView.jsx        # Tela de automações
            ├── FlowBuilderModal.jsx       # Editor de fluxo de automação
            └── CustomFieldsManager.jsx   # Gerenciador de campos personalizados
```

---

## Portas

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger (docs) | http://localhost:8000/docs |
