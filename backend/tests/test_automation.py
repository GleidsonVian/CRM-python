"""Tests for services/automation.py"""
import pytest
import models
from services.automation import (
    _render_vars,
    _evaluate_condition,
    _evaluate_structured_condition,
    _run_action,
    _execute_flow_steps,
)


# ── _render_vars ──────────────────────────────────────────────────────────────

class TestRenderVars:
    def test_replaces_known_var(self):
        assert _render_vars("Olá {{ deal.title }}", {"deal.title": "Projeto X"}) == "Olá Projeto X"

    def test_replaces_multiple_vars(self):
        result = _render_vars("{{ a }} e {{ b }}", {"a": "foo", "b": "bar"})
        assert result == "foo e bar"

    def test_unknown_var_becomes_empty(self):
        assert _render_vars("{{ x }}", {}) == ""

    def test_no_template_unchanged(self):
        assert _render_vars("texto simples", {"a": "1"}) == "texto simples"

    def test_spaces_inside_braces_handled(self):
        assert _render_vars("{{deal.title}}", {"deal.title": "X"}) == "X"


# ── _evaluate_condition ───────────────────────────────────────────────────────

class TestEvaluateCondition:
    def test_empty_condition_is_true(self):
        assert _evaluate_condition("", {}) is True

    def test_equals_numeric(self):
        assert _evaluate_condition("{{ price }} == 100", {"price": "100"}) is True

    def test_not_equals_numeric(self):
        assert _evaluate_condition("{{ price }} != 200", {"price": "100"}) is True

    def test_greater_than(self):
        assert _evaluate_condition("{{ price }} > 50", {"price": "100"}) is True
        assert _evaluate_condition("{{ price }} > 200", {"price": "100"}) is False

    def test_less_than(self):
        assert _evaluate_condition("{{ price }} < 200", {"price": "100"}) is True

    def test_contains(self):
        assert _evaluate_condition("{{ title }} contains VIP", {"title": "Cliente VIP"}) is True
        assert _evaluate_condition("{{ title }} contains vip", {"title": "Cliente VIP"}) is True

    def test_not_contains(self):
        assert _evaluate_condition("{{ title }} contains nada", {"title": "Cliente VIP"}) is False

    def test_structured_json_format(self):
        import json
        cond = json.dumps({"field": "deal.price", "operator": ">", "value": "50"})
        card = type("Card", (), {"price": 100, "title": "", "description": "", "stage_id": 1})()
        assert _evaluate_condition(cond, {}, card) is True


# ── _evaluate_structured_condition ───────────────────────────────────────────

class TestEvaluateStructuredCondition:
    def _card(self, price=500, title="Negócio", stage_id=1):
        return type("Card", (), {"price": price, "title": title, "description": "", "stage_id": stage_id})()

    def test_price_greater_than(self):
        cond = {"field": "deal.price", "operator": ">", "value": "100"}
        assert _evaluate_structured_condition(cond, {}, self._card(price=500)) is True

    def test_price_less_than_false(self):
        cond = {"field": "deal.price", "operator": ">", "value": "1000"}
        assert _evaluate_structured_condition(cond, {}, self._card(price=500)) is False

    def test_title_equals(self):
        cond = {"field": "deal.title", "operator": "==", "value": "Negócio"}
        assert _evaluate_structured_condition(cond, {}, self._card()) is True

    def test_title_contains(self):
        cond = {"field": "deal.title", "operator": "contains", "value": "negó"}
        assert _evaluate_structured_condition(cond, {}, self._card(title="Negócio")) is True

    def test_title_not_contains(self):
        cond = {"field": "deal.title", "operator": "!contains", "value": "VIP"}
        assert _evaluate_structured_condition(cond, {}, self._card(title="Normal")) is True

    def test_stage_id_match(self):
        cond = {"field": "deal.stage_id", "operator": "==", "stage_id": 5}
        assert _evaluate_structured_condition(cond, {}, self._card(stage_id=5)) is True

    def test_price_equals_string_comparison(self):
        cond = {"field": "deal.price", "operator": "==", "value": "500"}
        assert _evaluate_structured_condition(cond, {}, self._card(price=500)) is True


# ── _run_action ───────────────────────────────────────────────────────────────

class TestRunAction:
    def test_add_note(self, db, card):
        _run_action("add_note", {"content": "Nota automática"}, {}, card, db)
        activity = db.query(models.Activity).filter(
            models.Activity.card_id == card.id,
            models.Activity.type == "auto_note",
        ).first()
        assert activity is not None
        assert activity.content == "Nota automática"
        assert activity.actor == "Automação"

    def test_set_price(self, db, card):
        assert card.price == 1000.0
        _run_action("set_price", {"price": 2500}, {}, card, db)
        db.refresh(card)
        assert card.price == 2500.0

    def test_change_stage(self, db, card, pipeline):
        new_stage = models.Stage(name="Fechado", color="#22c55e", order=1, pipeline_id=pipeline.id)
        db.add(new_stage)
        db.commit()
        original_stage_id = card.stage_id
        _run_action("change_stage", {"stage_id": new_stage.id}, {}, card, db)
        db.refresh(card)
        assert card.stage_id == new_stage.id
        assert card.stage_id != original_stage_id

    def test_create_task(self, db, card):
        _run_action("create_task", {"title": "Seguimento", "due_days": 1}, {}, card, db)
        task = db.query(models.Task).filter(models.Task.card_id == card.id).first()
        assert task is not None
        assert task.title == "Seguimento"

    def test_set_field_title(self, db, card):
        _run_action("set_field", {"field": "deal.title", "value": "Novo título"}, {}, card, db)
        db.refresh(card)
        assert card.title == "Novo título"

    def test_set_field_price(self, db, card):
        _run_action("set_field", {"field": "deal.price", "value": "9999"}, {}, card, db)
        db.refresh(card)
        assert card.price == 9999.0

    def test_set_field_invalid_price_is_noop(self, db, card):
        original = card.price
        _run_action("set_field", {"field": "deal.price", "value": "nao_numero"}, {}, card, db)
        db.refresh(card)
        assert card.price == original

    def test_unknown_action_is_noop(self, db, card):
        # Should not raise
        _run_action("acao_inexistente", {}, {}, card, db)


# ── _execute_flow_steps ───────────────────────────────────────────────────────

class TestExecuteFlowSteps:
    def test_sequential_steps(self, db, card):
        steps = [
            {"type": "set_price", "config": {"price": 500}},
            {"type": "add_note", "config": {"content": "Preço atualizado"}},
        ]
        _execute_flow_steps(steps, {}, card, db)
        db.refresh(card)
        assert card.price == 500.0
        note = db.query(models.Activity).filter(
            models.Activity.card_id == card.id,
            models.Activity.type == "auto_note",
        ).first()
        assert note is not None

    def test_if_else_true_branch(self, db, card):
        steps = [{
            "type": "if_else",
            "condition": "{{ deal.price }} > 500",
            "true_steps":  [{"type": "add_note", "config": {"content": "VIP"}}],
            "false_steps": [{"type": "add_note", "config": {"content": "Normal"}}],
        }]
        _execute_flow_steps(steps, {"deal.price": "1000"}, card, db)
        note = db.query(models.Activity).filter(
            models.Activity.card_id == card.id,
            models.Activity.content == "VIP",
        ).first()
        assert note is not None

    def test_if_else_false_branch(self, db, card):
        steps = [{
            "type": "if_else",
            "condition": "{{ deal.price }} > 5000",
            "true_steps":  [{"type": "add_note", "config": {"content": "VIP"}}],
            "false_steps": [{"type": "add_note", "config": {"content": "Normal"}}],
        }]
        _execute_flow_steps(steps, {"deal.price": "100"}, card, db)
        note = db.query(models.Activity).filter(
            models.Activity.card_id == card.id,
            models.Activity.content == "Normal",
        ).first()
        assert note is not None

    def test_empty_steps_is_noop(self, db, card):
        _execute_flow_steps([], {}, card, db)  # must not raise
