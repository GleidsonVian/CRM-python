"""
Testes de API — endpoints HTTP reais via FastAPI TestClient.

Cada teste faz requisições HTTP reais contra o app, usando um banco
SQLite em memória isolado (fixture `client` do conftest.py).
"""
import pytest
from services.auth import hash_password
import models


# ── Helpers ───────────────────────────────────────────────────────────────────

def auth_header(client, email="admin@nexus.com", password="admin123"):
    """Faz login e retorna o header Authorization pronto para usar."""
    res = client.post("/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login falhou: {res.json()}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(db):
    """Cria o usuário admin no banco de testes."""
    user = models.User(
        name="Admin",
        email="admin@nexus.com",
        role="admin",
        password_hash=hash_password("admin123"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user


@pytest.fixture
def headers(client, admin_user):
    """Header de autenticação para o admin."""
    return auth_header(client)


# ── Auth ──────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_sucesso(self, client, admin_user):
        res = client.post("/auth/login", json={"email": "admin@nexus.com", "password": "admin123"})
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["user_email"] == "admin@nexus.com"

    def test_login_senha_errada(self, client, admin_user):
        res = client.post("/auth/login", json={"email": "admin@nexus.com", "password": "errada"})
        assert res.status_code == 401

    def test_login_usuario_inexistente(self, client):
        res = client.post("/auth/login", json={"email": "nao@existe.com", "password": "123"})
        assert res.status_code == 401

    def test_me_retorna_usuario_logado(self, client, headers):
        res = client.get("/auth/me", headers=headers)
        assert res.status_code == 200
        assert res.json()["user_email"] == "admin@nexus.com"

    def test_me_sem_token_retorna_401(self, client):
        res = client.get("/auth/me")
        assert res.status_code == 401


# ── Pipelines ─────────────────────────────────────────────────────────────────

class TestPipelines:
    def test_listar_pipelines_vazio(self, client, headers):
        res = client.get("/pipelines", headers=headers)
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_criar_pipeline(self, client, headers):
        res = client.post("/pipelines", json={"name": "Vendas 2025"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Vendas 2025"

    def test_criar_pipeline_duplicado_retorna_erro(self, client, headers):
        client.post("/pipelines", json={"name": "Único"}, headers=headers)
        res = client.post("/pipelines", json={"name": "Único"}, headers=headers)
        assert res.status_code == 400

    def test_atualizar_pipeline(self, client, headers):
        created = client.post("/pipelines", json={"name": "Antigo"}, headers=headers).json()
        res = client.put(f"/pipelines/{created['id']}", json={"name": "Novo"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Novo"

    def test_deletar_pipeline(self, client, headers):
        created = client.post("/pipelines", json={"name": "Deletar"}, headers=headers).json()
        res = client.delete(f"/pipelines/{created['id']}", headers=headers)
        assert res.status_code == 200


# ── Cards ─────────────────────────────────────────────────────────────────────

class TestCards:
    @pytest.fixture
    def stage_id(self, client, headers):
        pipeline = client.post("/pipelines", json={"name": "P"}, headers=headers).json()
        stage = client.post("/stages", json={"name": "Nova", "pipeline_id": pipeline["id"], "order": 0}, headers=headers).json()
        return stage["id"]

    def test_criar_card(self, client, headers, stage_id):
        res = client.post("/cards", json={"title": "Negócio A", "stage_id": stage_id}, headers=headers)
        assert res.status_code == 200
        body = res.json()
        assert body["title"] == "Negócio A"
        assert body["id"] is not None

    def test_buscar_card_por_id(self, client, headers, stage_id):
        card = client.post("/cards", json={"title": "Buscar", "stage_id": stage_id}, headers=headers).json()
        res = client.get(f"/cards/{card['id']}", headers=headers)
        assert res.status_code == 200
        assert res.json()["title"] == "Buscar"

    def test_buscar_card_inexistente_retorna_404(self, client, headers):
        res = client.get("/cards/999999", headers=headers)
        assert res.status_code == 404

    def test_listar_cards_por_pipeline(self, client, headers, stage_id):
        client.post("/cards", json={"title": "Card 1", "stage_id": stage_id}, headers=headers)
        client.post("/cards", json={"title": "Card 2", "stage_id": stage_id}, headers=headers)
        pipeline_id = client.get(f"/stages/{stage_id}", headers=headers).json()["pipeline_id"]
        res = client.get(f"/cards?pipeline_id={pipeline_id}", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 2

    def test_mover_card_para_outra_etapa(self, client, headers, stage_id):
        pipeline_id = client.get(f"/stages/{stage_id}", headers=headers).json()["pipeline_id"]
        nova = client.post("/stages", json={"name": "Fechado", "pipeline_id": pipeline_id, "order": 1}, headers=headers).json()
        card = client.post("/cards", json={"title": "Mover", "stage_id": stage_id}, headers=headers).json()
        res = client.put(f"/cards/{card['id']}/move", json={"new_stage_id": nova["id"], "new_order": 0}, headers=headers)
        assert res.status_code == 200
        assert res.json()["stage_id"] == nova["id"]

    def test_deletar_card(self, client, headers, stage_id):
        card = client.post("/cards", json={"title": "Deletar", "stage_id": stage_id}, headers=headers).json()
        res = client.delete(f"/cards/{card['id']}", headers=headers)
        assert res.status_code == 200
        assert client.get(f"/cards/{card['id']}", headers=headers).status_code == 404


# ── Leads ─────────────────────────────────────────────────────────────────────

class TestLeads:
    @pytest.fixture
    def lead_stage_id(self, client, headers):
        pipeline = client.post("/pipelines", json={"name": "Leads Pipeline"}, headers=headers).json()
        stage = client.post("/stages", json={"name": "Novo", "pipeline_id": pipeline["id"], "order": 0}, headers=headers).json()
        return stage["id"]

    def test_criar_lead(self, client, headers, lead_stage_id):
        res = client.post("/leads", json={"title": "Lead Teste", "stage_id": lead_stage_id}, headers=headers)
        assert res.status_code == 200
        assert res.json()["title"] == "Lead Teste"

    def test_buscar_lead_por_id(self, client, headers, lead_stage_id):
        lead = client.post("/leads", json={"title": "Buscar", "stage_id": lead_stage_id}, headers=headers).json()
        res = client.get(f"/leads/{lead['id']}", headers=headers)
        assert res.status_code == 200

    def test_atualizar_lead(self, client, headers, lead_stage_id):
        lead = client.post("/leads", json={"title": "Original", "stage_id": lead_stage_id}, headers=headers).json()
        res = client.put(f"/leads/{lead['id']}", json={"title": "Atualizado", "stage_id": lead_stage_id}, headers=headers)
        assert res.status_code == 200
        assert res.json()["title"] == "Atualizado"

    def test_deletar_lead(self, client, headers, lead_stage_id):
        lead = client.post("/leads", json={"title": "Deletar", "stage_id": lead_stage_id}, headers=headers).json()
        res = client.delete(f"/leads/{lead['id']}", headers=headers)
        assert res.status_code == 200

    def test_buscar_lead_inexistente_retorna_404(self, client, headers):
        res = client.get("/leads/999999", headers=headers)
        assert res.status_code == 404


# ── Contatos ──────────────────────────────────────────────────────────────────

class TestContatos:
    def test_criar_contato(self, client, headers):
        res = client.post("/contacts", json={"first_name": "João", "last_name": "Silva"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["first_name"] == "João"

    def test_listar_contatos(self, client, headers):
        client.post("/contacts", json={"first_name": "Ana"}, headers=headers)
        res = client.get("/contacts", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_atualizar_contato(self, client, headers):
        contato = client.post("/contacts", json={"first_name": "Maria"}, headers=headers).json()
        res = client.put(f"/contacts/{contato['id']}", json={"first_name": "Maria Clara"}, headers=headers)
        assert res.status_code == 200
        assert res.json()["first_name"] == "Maria Clara"


# ── Automações ────────────────────────────────────────────────────────────────

class TestAutomacoes:
    @pytest.fixture
    def pipeline_stage(self, client, headers):
        pipeline = client.post("/pipelines", json={"name": "Auto Pipeline"}, headers=headers).json()
        stage = client.post("/stages", json={"name": "Etapa", "pipeline_id": pipeline["id"], "order": 0}, headers=headers).json()
        return pipeline, stage

    def test_criar_automacao(self, client, headers, pipeline_stage):
        pipeline, stage = pipeline_stage
        res = client.post("/automations", json={
            "name": "Minha regra",
            "stage_id": stage["id"],
            "pipeline_id": pipeline["id"],
            "action_type": "add_note",
            "config": {"content": "Nota automática"},
            "enabled": True,
        }, headers=headers)
        assert res.status_code == 200
        assert res.json()["name"] == "Minha regra"

    def test_listar_automacoes_por_pipeline(self, client, headers, pipeline_stage):
        pipeline, stage = pipeline_stage
        client.post("/automations", json={
            "name": "Regra 1", "stage_id": stage["id"],
            "pipeline_id": pipeline["id"], "action_type": "add_note",
            "config": {}, "enabled": True,
        }, headers=headers)
        res = client.get(f"/automations?pipeline_id={pipeline['id']}", headers=headers)
        assert res.status_code == 200
        assert len(res.json()) >= 1

    def test_deletar_automacao(self, client, headers, pipeline_stage):
        pipeline, stage = pipeline_stage
        automacao = client.post("/automations", json={
            "name": "Deletar", "stage_id": stage["id"],
            "pipeline_id": pipeline["id"], "action_type": "add_note",
            "config": {}, "enabled": True,
        }, headers=headers).json()
        res = client.delete(f"/automations/{automacao['id']}", headers=headers)
        assert res.status_code == 200
