# Testes — Nexus CRM Backend

## Como rodar

```powershell
# dentro de backend/
.\venv\Scripts\pytest.exe tests/ -v
```

Resultado esperado: todos os testes passando em ~2 segundos.

---

## Estrutura

```
tests/
├── conftest.py          # Fixtures compartilhadas (banco em memória, dados de exemplo)
├── test_permissions.py  # Lógica de permissões RBAC
├── test_automation.py   # Engine de automações (condições, ações, fluxos)
├── test_api.py          # Endpoints HTTP (cria, lê, atualiza, deleta via API real)
└── README.md            # Este arquivo
```

---

## O que é cada tipo de teste

### Testes de serviço (`test_permissions.py`, `test_automation.py`)
Testam funções Python puras, sem HTTP.
Rápidos. Cobrem lógica de negócio: "dado X, a função retorna Y".

### Testes de API (`test_api.py`)
Testam os endpoints HTTP do FastAPI usando `TestClient`.
Cobrem o fluxo completo: requisição → banco → resposta.
São o tipo mais parecido com o que um usuário real faz.

---

## Fixtures disponíveis (`conftest.py`)

| Fixture        | O que cria                                      |
|----------------|-------------------------------------------------|
| `db`           | Sessão SQLite em memória, limpa após cada teste |
| `client`       | Cliente HTTP com banco isolado                  |
| `admin_role`   | Cargo Administrador (permissões totais)          |
| `vendedor_role`| Cargo Vendedor (só próprios registros)          |
| `pipeline`     | Pipeline "Test Pipeline"                        |
| `stage`        | Etapa "Em andamento" dentro do pipeline         |
| `card`         | Negócio de R$ 1.000 na etapa acima              |

Para criar uma nova fixture, adicione em `conftest.py`:

```python
@pytest.fixture
def minha_fixture(db):
    obj = models.MinhaModel(campo="valor")
    db.add(obj)
    db.commit()
    return obj
```

---

## Como adicionar um novo teste

1. Identifique o arquivo certo (serviço → `test_*.py` existente; endpoint → `test_api.py`)
2. Crie uma função começando com `test_`
3. Use as fixtures do `conftest.py` como parâmetros
4. Rode `.\venv\Scripts\pytest.exe tests/ -v` para confirmar

Exemplo:

```python
def test_deletar_card_retorna_ok(client, stage):
    # cria
    res = client.post("/cards", json={"title": "Deletar", "stage_id": stage.id})
    card_id = res.json()["id"]
    # deleta
    res = client.delete(f"/cards/{card_id}")
    assert res.status_code == 200
    # confirma que sumiu
    res = client.get(f"/cards/{card_id}")
    assert res.status_code == 404
```

---

## Cobertura atual

| Área                        | Coberta? | Arquivo                  |
|-----------------------------|----------|--------------------------|
| Permissões RBAC v1/v2       | ✅        | test_permissions.py      |
| Render de variáveis         | ✅        | test_automation.py       |
| Avaliação de condições      | ✅        | test_automation.py       |
| Ações de automação          | ✅        | test_automation.py       |
| Fluxos if/else              | ✅        | test_automation.py       |
| Endpoints de Cards          | ✅        | test_api.py              |
| Endpoints de Leads          | ✅        | test_api.py              |
| Endpoints de Contatos       | ✅        | test_api.py              |
| Endpoints de Pipelines      | ✅        | test_api.py              |
| Endpoints de Automações     | ✅        | test_api.py              |
| Autenticação JWT            | ✅        | test_api.py              |
| Webhooks outbound           | ❌        | —                        |
| Workflows (execução)        | ❌        | —                        |
| Relatórios                  | ❌        | —                        |
| Campos personalizados       | ❌        | —                        |

---

## Padrão de nomenclatura

```
test_<o_que_faz>_<resultado_esperado>

✅ test_criar_card_retorna_201
✅ test_buscar_card_inexistente_retorna_404
✅ test_mover_lead_atualiza_stage_id
❌ test_card          ← vago demais
❌ test_funciona      ← não descreve nada
```

---

## Perguntas frequentes

**"Preciso do banco real para rodar os testes?"**
Não. Todos os testes usam SQLite em memória. O arquivo `crm.db` não é tocado.

**"Um teste pode quebrar o banco de produção?"**
Não. O banco de testes é criado e destruído a cada execução.

**"Como sei se minha mudança quebrou algo?"**
Rode `.\venv\Scripts\pytest.exe tests/ -v` antes e depois da mudança.
Se todos passam: seguro. Se algum falha: você sabe exatamente o quê.
