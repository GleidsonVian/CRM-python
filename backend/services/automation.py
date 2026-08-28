import re, json, socket, ipaddress
from urllib import request as urllib_req
from urllib.request import urlopen
from urllib.parse import urlparse
import models
from database import SessionLocal


def _render_vars(template: str, vars: dict) -> str:
    return re.sub(r'\{\{\s*([^}]+?)\s*\}\}', lambda m: str(vars.get(m.group(1).strip(), '')), template)


def _build_vars(card, db) -> dict:
    contact = card.contacts[0] if card.contacts else None
    stage = db.query(models.Stage).filter(models.Stage.id == card.stage_id).first()
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == stage.pipeline_id).first() if stage else None
    
    # Base dictionary
    res = {
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
    
    # Load custom fields
    entity_type = "deal" if getattr(card, "__tablename__", "") == "cards" else "lead"
    cf_values = db.query(models.CustomFieldValue, models.CustomField)\
        .join(models.CustomField, models.CustomFieldValue.field_id == models.CustomField.id)\
        .filter(models.CustomFieldValue.entity_id == card.id, models.CustomField.entity == entity_type)\
        .all()
        
    for val, field in cf_values:
        _register_cf_var(res, field, val.value, prefix='cf')

    # Campos personalizados do contato vinculado -> contact_cf.<key>
    if contact is not None:
        contact_cf = db.query(models.CustomFieldValue, models.CustomField)            .join(models.CustomField, models.CustomFieldValue.field_id == models.CustomField.id)            .filter(models.CustomFieldValue.entity_id == contact.id, models.CustomField.entity == 'contact')            .all()
        for val, field in contact_cf:
            _register_cf_var(res, field, val.value, prefix='contact_cf')

    return res


def _register_cf_var(res: dict, field, raw_value, prefix: str = 'cf'):
    """Registra um campo personalizado na chave canonica + aliases de compatibilidade."""
    v_str = str(raw_value or '')
    res[f"{prefix}.{field.key}"] = v_str          # forma canonica emitida pela UI
    res[f"{prefix}.{field.name}"] = v_str
    res[f"{prefix}:{field.id}"] = v_str
    if prefix == 'cf':
        # aliases mantidos para fluxos salvos antes da forma canonica
        res[f"custom.{field.key}"] = v_str
        res.setdefault(field.key, v_str)
        res.setdefault(field.name, v_str)
        res.setdefault(field.key.lower(), v_str)


def url_is_safe(url: str):
    """Bloqueia schemes fora de http(s) e hosts que resolvem para redes internas (SSRF)."""
    try:
        parsed = urlparse(url)
    except Exception:
        return False, 'URL invalida'
    if parsed.scheme not in ('http', 'https'):
        return False, 'Apenas URLs http:// ou https:// sao permitidas'
    host = parsed.hostname
    if not host:
        return False, 'URL sem host'
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False, f'Nao foi possivel resolver o host "{host}"'
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_reserved or ip.is_multicast or ip.is_unspecified):
            return False, f'O host "{host}" aponta para um endereco interno ({ip}) - bloqueado por seguranca'
    return True, ''


def flatten_json(value, prefix: str = '', out=None, max_items: int = 5):
    """Achata um JSON em linhas [{path, sample, type}] para a UI de mapeamento."""
    if out is None:
        out = []
    if isinstance(value, dict):
        for k, v in value.items():
            flatten_json(v, f"{prefix}.{k}" if prefix else str(k), out, max_items)
    elif isinstance(value, list):
        for idx, v in enumerate(value[:max_items]):
            flatten_json(v, f"{prefix}.{idx}" if prefix else str(idx), out, max_items)
    else:
        out.append({
            'path': prefix,
            'sample': '' if value is None else str(value),
            'type': 'null' if value is None else type(value).__name__,
        })
    return out


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


def _json_path_get(data, path: str):
    """Le um caminho pontuado ("endereco.rua", "itens.0.nome") de um JSON."""
    cur = data
    for part in str(path).split('.'):
        if isinstance(cur, dict):
            cur = cur.get(part)
        elif isinstance(cur, list):
            try:
                cur = cur[int(part)]
            except (ValueError, IndexError):
                return None
        else:
            return None
    return cur


def _find_custom_field(db, target: str, entity_type: str):
    """Resolve um alvo de mapeamento para um CustomField (por id, key ou nome)."""
    clean = target
    if ':' in target:
        try:
            cf_id = int(target.split(':', 1)[1])
            cf = db.query(models.CustomField).filter(
                models.CustomField.id == cf_id,
                models.CustomField.entity == entity_type,
            ).first()
            if cf:
                return cf
        except ValueError:
            pass
    if '.' in target:
        clean = target.split('.', 1)[1]
    return db.query(models.CustomField).filter(
        models.CustomField.entity == entity_type,
        (models.CustomField.key == clean.lower()) | (models.CustomField.name.ilike(clean)),
    ).first()


def _upsert_custom_value(db, cf, entity_id: int, val: str):
    existing = db.query(models.CustomFieldValue).filter(
        models.CustomFieldValue.field_id == cf.id,
        models.CustomFieldValue.entity_id == entity_id,
    ).first()
    if existing:
        existing.value = val
    else:
        db.add(models.CustomFieldValue(field_id=cf.id, entity_id=entity_id, value=val))
    db.commit()


def _set_any_field(card, target: str, val: str, db):
    """Grava um valor em qualquer campo alcancavel a partir do card: nativo do
    negocio, do contato vinculado, ou campo personalizado de um dos dois."""
    contact = card.contacts[0] if getattr(card, 'contacts', None) else None

    # -- Campos nativos do negocio --
    if target == 'deal.title':
        card.title = val
        db.commit()
        _log_activity(db, card.id, 'title_changed', f'Título alterado para "{val}"', actor='Automação')
        return
    if target == 'deal.price':
        try:
            old = card.price or 0
            card.price = float(str(val).replace(',', '.'))
            db.commit()
            _log_activity(db, card.id, 'price_changed', f'Valor alterado de R$ {old:.2f} para R$ {card.price:.2f}', actor='Automação')
        except (ValueError, TypeError):
            _log_activity(db, card.id, 'webhook_mapping_error', f'"{val}" não é um número válido para o valor do negócio', actor='Automação')
        return
    if target == 'deal.description':
        card.description = val
        db.commit()
        _log_activity(db, card.id, 'field_changed', 'Descrição atualizada', actor='Automação')
        return
    if target == 'deal.stage_id':
        try:
            stage = db.query(models.Stage).filter(models.Stage.id == int(val)).first()
            if stage:
                card.stage_id = stage.id
                db.commit()
                _log_activity(db, card.id, 'moved', f'Movido para a etapa {stage.name}', actor='Automação')
        except (ValueError, TypeError):
            pass
        return

    # -- Campos nativos do contato vinculado --
    if target.startswith('contact.'):
        if contact is None:
            _log_activity(db, card.id, 'webhook_mapping_error', f'Não há contato vinculado para preencher "{target}"', actor='Automação')
            return
        attr = target.split('.', 1)[1]
        if attr == 'name':
            parts = val.strip().split(' ', 1)
            contact.first_name = parts[0]
            contact.last_name = parts[1] if len(parts) > 1 else ''
        elif attr in ('email', 'phone'):
            setattr(contact, attr, val)
        else:
            return
        db.commit()
        _log_activity(db, card.id, 'contact_changed', f'Contato: {attr} atualizado para "{val}"', actor='Automação')
        return

    # -- Campo personalizado do contato --
    if target.startswith('contact_cf'):
        if contact is None:
            _log_activity(db, card.id, 'webhook_mapping_error', f'Não há contato vinculado para preencher "{target}"', actor='Automação')
            return
        cf = _find_custom_field(db, target, 'contact')
        if cf:
            _upsert_custom_value(db, cf, contact.id, val)
            _log_activity(db, card.id, 'custom_field_changed', f'Campo do contato "{cf.name}" atualizado para "{val}"', actor='Automação')
        return

    # -- Campo personalizado do negocio/lead --
    entity_type = "deal" if getattr(card, "__tablename__", "") == "cards" else "lead"
    cf = _find_custom_field(db, target, entity_type)
    if cf:
        _upsert_custom_value(db, cf, card.id, val)
        _log_activity(db, card.id, 'custom_field_changed', f'Campo "{cf.name}" atualizado para "{val}"', actor='Automação')
    else:
        _log_activity(db, card.id, 'webhook_mapping_error', f'Campo "{target}" não encontrado no CRM', actor='Automação')


def apply_response_mapping(card, res_json, mapping, db):
    """Aplica {caminho_no_json: campo_do_crm} na entidade. Devolve o que foi gravado."""
    if isinstance(mapping, str):
        try:
            mapping = json.loads(mapping)
        except Exception:
            return []
    if not isinstance(mapping, dict):
        return []
    applied = []
    for json_path, target_field in mapping.items():
        if not target_field:
            continue
        val = _json_path_get(res_json, json_path)
        if val is None:
            applied.append({'path': json_path, 'field': target_field, 'value': None, 'ok': False,
                            'reason': 'caminho não encontrado na resposta'})
            continue
        _set_any_field(card, target_field, str(val), db)
        applied.append({'path': json_path, 'field': target_field, 'value': str(val), 'ok': True})
    return applied


def call_webhook(method: str, url: str, payload: str, headers: dict = None, timeout: int = 10):
    """Dispara a requisicao HTTP. Devolve (status, body, error). Nunca levanta."""
    ok, reason = url_is_safe(url)
    if not ok:
        return None, '', reason
    method = (method or 'POST').upper()
    body = payload.encode('utf-8') if method in ('POST', 'PUT', 'PATCH') and payload else None
    req_headers = {k: v for k, v in (headers or {}).items() if k and v}
    if body and not any(h.lower() == 'content-type' for h in req_headers):
        req_headers['Content-Type'] = 'application/json'
    try:
        req = urllib_req.Request(url, data=body, headers=req_headers, method=method)
        with urllib_req.urlopen(req, timeout=timeout) as response:
            return response.status, response.read().decode('utf-8', errors='replace'), ''
    except Exception as e:
        status = getattr(e, 'code', None)
        err_body = ''
        try:
            err_body = e.read().decode('utf-8', errors='replace')
        except Exception:
            pass
        return status, err_body, str(e)


def _run_action(step_type: str, cfg: dict, vars: dict, card, db):
    if step_type == 'webhook':
        url = _render_vars(cfg.get('url', ''), vars)
        if url:
            payload = _render_vars(cfg.get('payload', '') or '', vars)
            method = (cfg.get('method') or 'POST').upper()
            headers = {k: _render_vars(str(v), vars) for k, v in (cfg.get('headers') or {}).items()}

            status, res_body, error = call_webhook(method, url, payload, headers)

            if error and status is None:
                _log_activity(db, card.id, 'webhook_error', f'Falha no webhook para {url}: {error}', actor='Automação')
                return

            _log_activity(db, card.id, 'webhook', f'Webhook {method} {url} -> HTTP {status}', actor='Automação')

            mapping = cfg.get('response_mapping')
            if mapping:
                try:
                    apply_response_mapping(card, json.loads(res_body), mapping, db)
                except Exception as parse_err:
                    _log_activity(db, card.id, 'webhook_mapping_error',
                                  f'Resposta do webhook não é um JSON válido: {parse_err}', actor='Automação')

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
