import re, json
from urllib import request as urllib_req
from urllib.request import urlopen
import models
from database import SessionLocal


def _render_vars(template: str, vars: dict) -> str:
    return re.sub(r'\{\{\s*([^}]+?)\s*\}\}', lambda m: str(vars.get(m.group(1).strip(), '')), template)


def _build_vars(card, db) -> dict:
    contact = card.contacts[0] if card.contacts else None
    stage = db.query(models.Stage).filter(models.Stage.id == card.stage_id).first()
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first() if stage else None
    return {
        'deal.title': card.title or '',
        'deal.price': str(card.price or 0),
        'deal.id': str(card.id),
        'deal.description': card.description or '',
        'contact.name': f"{contact.first_name} {contact.last_name or ''}".strip() if contact else '',
        'contact.email': contact.email or '' if contact else '',
        'contact.phone': contact.phone or '' if contact else '',
        'stage.name': stage.name if stage else '',
        'pipeline.name': pipeline.name if pipeline else '',
    }


def _evaluate_structured_condition(cond: dict, vars: dict, card) -> bool:
    field    = cond.get('field', '')
    operator = cond.get('operator', '==')
    value    = str(cond.get('value', ''))

    if field == 'deal.price':
        actual = str(card.price or 0) if card else vars.get('deal.price', '0')
    elif field == 'deal.title':
        actual = (card.title or '') if card else vars.get('deal.title', '')
    elif field == 'deal.description':
        actual = (card.description or '') if card else vars.get('deal.description', '')
    elif field == 'deal.stage_id':
        actual = str(card.stage_id) if card else ''
        stage_id = cond.get('stage_id')
        if stage_id is not None:
            value = str(stage_id)
    else:
        actual = vars.get(field, '')

    if operator in ('>', '<', '>=', '<=', '==', '!='):
        try:
            l, r = float(actual), float(value)
            return eval(f"{l} {operator} {r}")
        except (ValueError, TypeError):
            if operator == '==': return actual.lower() == value.lower()
            if operator == '!=': return actual.lower() != value.lower()
            return False
    elif operator == 'contains':
        return value.lower() in actual.lower()
    elif operator == '!contains':
        return value.lower() not in actual.lower()
    return False


def _evaluate_condition(condition: str, vars: dict, card=None) -> bool:
    if not condition:
        return True
    try:
        cond = json.loads(condition)
        if isinstance(cond, dict) and 'field' in cond:
            return _evaluate_structured_condition(cond, vars, card)
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    rendered = _render_vars(condition, vars)
    if 'contains' in condition.lower():
        left_rendered = _render_vars(condition[:condition.lower().find('contains')].strip(), vars).lower()
        right_rendered = _render_vars(condition[condition.lower().find('contains') + 8:].strip().strip('"\''), vars).lower()
        return right_rendered in left_rendered
    for op in ['>=', '<=', '!=', '>', '<', '==']:
        if op in rendered:
            parts = rendered.split(op, 1)
            left, right = parts[0].strip(), parts[1].strip()
            try:
                l, r = float(left), float(right)
                return eval(f"{l} {op} {r}")
            except ValueError:
                if op == '==': return left == right
                if op == '!=': return left != right
    return bool(rendered.strip())


def _log_activity(db, card_id: int, activity_type: str, content: str, actor: str = 'Usuário'):
    db.add(models.Activity(card_id=card_id, type=activity_type, content=content, actor=actor))
    db.commit()


def _run_action(step_type: str, cfg: dict, vars: dict, card, db):
    if step_type == 'webhook':
        url = _render_vars(cfg.get('url', ''), vars)
        if url:
            payload = _render_vars(cfg.get('payload', '{}'), vars)
            method = cfg.get('method', 'POST').upper()
            try:
                body = payload.encode('utf-8') if method in ('POST', 'PUT', 'PATCH') else None
                req = urllib_req.Request(url, data=body, headers={'Content-Type': 'application/json'}, method=method)
                urllib_req.urlopen(req, timeout=10)
            except Exception:
                pass
            _log_activity(db, card.id, 'webhook', f'Webhook {method} disparado para {url}', actor='Automação')

    elif step_type == 'assign_user':
        uid = cfg.get('user_id')
        if uid:
            user = db.query(models.User).filter(models.User.id == int(uid)).first()
            if user:
                card.responsible_user_id = user.id
                if user not in card.users:
                    card.users.append(user)
                db.commit()
                _log_activity(db, card.id, 'user_assigned', f'Responsável {user.name} atribuído', actor='Automação')

    elif step_type == 'add_note':
        content = _render_vars(cfg.get('content', ''), vars)
        if content:
            db.add(models.Activity(card_id=card.id, type='auto_note', content=content, actor='Automação'))
            db.commit()

    elif step_type == 'set_price':
        price = cfg.get('price')
        if price not in (None, ''):
            old = card.price or 0
            card.price = float(price)
            db.commit()
            _log_activity(db, card.id, 'price_changed',
                f'Valor alterado de R$ {old:.2f} para R$ {float(price):.2f}', actor='Automação')

    elif step_type == 'set_field':
        field = cfg.get('field', '')
        if field == 'deal.title':
            val = _render_vars(str(cfg.get('value', '')), vars)
            if val:
                card.title = val
                db.commit()
                _log_activity(db, card.id, 'title_changed', f'Título alterado para "{val}"', actor='Automação')
        elif field == 'deal.price':
            val = _render_vars(str(cfg.get('value', '')), vars)
            try:
                old = card.price or 0
                card.price = float(val)
                db.commit()
                _log_activity(db, card.id, 'price_changed',
                    f'Valor alterado de R$ {old:.2f} para R$ {float(val):.2f}', actor='Automação')
            except (ValueError, TypeError):
                pass
        elif field == 'deal.description':
            val = _render_vars(str(cfg.get('value', '')), vars)
            card.description = val
            db.commit()
            _log_activity(db, card.id, 'field_changed', 'Descrição atualizada', actor='Automação')
        elif field == 'deal.stage_id':
            stage_id = cfg.get('stage_id')
            if stage_id:
                stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
                if stage:
                    card.stage_id = stage.id
                    db.commit()
                    _log_activity(db, card.id, 'moved', f'Movido para a etapa {stage.name}', actor='Automação')

    elif step_type == 'change_stage':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
            if stage:
                card.stage_id = stage.id
                db.commit()
                _log_activity(db, card.id, 'moved', f'Movido para etapa "{stage.name}"', actor='Automação')

    elif step_type == 'move_pipeline':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == int(stage_id)).first()
            if stage:
                card.stage_id = stage.id
                db.commit()
                pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first()
                _log_activity(db, card.id, 'moved',
                    f'Movido para "{pipeline.name if pipeline else "?"}" → "{stage.name}"', actor='Automação')

    elif step_type == 'create_task':
        title_raw = cfg.get('title', 'Tarefa automática')
        title = _render_vars(title_raw, vars)
        desc  = _render_vars(cfg.get('description', ''), vars)
        due_days = int(cfg.get('due_days', 1))
        from datetime import datetime, timedelta
        due = (datetime.now() + timedelta(days=due_days)).strftime('%Y-%m-%d') if due_days > 0 else None
        task = models.Task(
            title=title,
            description=desc,
            priority=cfg.get('priority', 'normal'),
            due_date=due,
            card_id=card.id,
            status='todo',
        )
        db.add(task)
        db.commit()
        _log_activity(db, card.id, 'task_created', f'Tarefa criada: "{title}"', actor='Automação')

    elif step_type == 'pause':
        amount = cfg.get('delay_amount', 1)
        unit = cfg.get('delay_unit', 'hours')
        _log_activity(db, card.id, 'pause', f'Pausa configurada: {amount} {unit}', actor='Automação')

    elif step_type == 'send_email':
        to   = _render_vars(cfg.get('to', ''), vars)
        subj = _render_vars(cfg.get('subject', ''), vars)
        body = _render_vars(cfg.get('body', ''), vars)
        _log_activity(db, card.id, 'email_sent', f'E-mail para {to}: {subj}', actor='Automação')


def _execute_flow_steps(steps: list, vars: dict, card, db):
    for step in steps:
        t = step.get('type')
        if t == 'if_else':
            result = _evaluate_condition(step.get('condition', ''), vars, card)
            branch = step.get('true_steps', []) if result else step.get('false_steps', [])
            _execute_flow_steps(branch, vars, card, db)
        else:
            _run_action(t, step.get('config', {}), vars, card, db)


def _execute_workflow_step(action_type: str, cfg: dict, card: object, db) -> str:
    if action_type == 'change_stage':
        stage_id = cfg.get('stage_id')
        if stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
            if stage:
                card.stage_id = stage_id
                return f"Etapa alterada para '{stage.name}'"
        return "Etapa não encontrada"
    elif action_type == 'assign_user':
        from sqlalchemy import text as _text
        user_id = cfg.get('user_id')
        if user_id:
            user = db.query(models.User).filter(models.User.id == user_id).first()
            if user:
                existing = db.execute(
                    _text("SELECT 1 FROM card_users WHERE card_id=:c AND user_id=:u"),
                    {"c": card.id, "u": user_id}
                ).first()
                if not existing:
                    db.execute(_text("INSERT INTO card_users (card_id, user_id) VALUES (:c,:u)"), {"c": card.id, "u": user_id})
                return f"Usuário '{user.name}' atribuído"
        return "Usuário não encontrado"
    elif action_type == 'add_note':
        text_val = cfg.get('text', '')
        if text_val:
            db.add(models.Activity(card_id=card.id, type='note', content=text_val, actor='Workflow'))
            return "Nota adicionada"
        return "Texto vazio"
    elif action_type == 'send_webhook':
        url = cfg.get('url', '')
        if url:
            payload_data = json.dumps({'card_id': card.id, 'card_title': card.title, 'stage_id': card.stage_id})
            try:
                req = urllib_req.Request(url, data=payload_data.encode(), headers={'Content-Type': 'application/json'}, method='POST')
                with urlopen(req, timeout=10) as resp:
                    return f"Webhook enviado ({resp.status})"
            except Exception as e:
                raise Exception(f"Webhook falhou: {e}")
        return "URL vazia"
    elif action_type == 'move_to_pipeline':
        target_stage_id = cfg.get('target_stage_id')
        if target_stage_id:
            stage = db.query(models.Stage).filter(models.Stage.id == target_stage_id).first()
            if stage:
                card.stage_id = target_stage_id
                pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first()
                return f"Card movido para '{pipeline.name if pipeline else '?'}' → '{stage.name}'"
        return "Etapa destino não encontrada"
    elif action_type == 'set_price':
        price = cfg.get('price')
        if price is not None:
            card.price = float(price)
            return f"Valor definido como R$ {price}"
        return "Valor não informado"
    return f"Ação '{action_type}' desconhecida"


def _execute_rule(rule_id: int, card_id: int):
    db = SessionLocal()
    try:
        rule = db.query(models.AutomationRule).filter(models.AutomationRule.id == rule_id).first()
        card = db.query(models.Card).filter(models.Card.id == card_id).first()
        if not rule or not card:
            return
        cfg = rule.config or {}
        vars_map = _build_vars(card, db)
        if cfg.get('version') == 1:
            _execute_flow_steps(cfg.get('steps', []), vars_map, card, db)
        else:
            _run_action(rule.action_type, cfg, vars_map, card, db)
    finally:
        db.close()
