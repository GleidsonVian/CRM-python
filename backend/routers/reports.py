from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select

import models
from database import get_db

router = APIRouter()


@router.get("/reports/summary")
def reports_summary(db: Session = Depends(get_db)):
    cards = db.query(models.Card).all()
    leads = db.query(models.Lead).all()
    total_cards  = len(cards)
    total_value  = sum(c.price or 0 for c in cards)
    total_leads  = len(leads)
    converted    = sum(1 for l in leads if l.converted)
    conv_rate    = round(converted / total_leads * 100, 1) if total_leads else 0
    avg_value    = round(total_value / total_cards, 2) if total_cards else 0

    won_stages = db.query(models.Stage).filter(
        models.Stage.name.ilike('%ganho%') | models.Stage.name.ilike('%won%') |
        models.Stage.name.ilike('%conclu%') | models.Stage.name.ilike('%sucesso%')
    ).all()
    won_ids   = {s.id for s in won_stages}
    won_cards = [c for c in cards if c.stage_id in won_ids]
    won_value = sum(c.price or 0 for c in won_cards)
    win_rate  = round(len(won_cards) / total_cards * 100, 1) if total_cards else 0

    return {
        "total_cards": total_cards,
        "total_value": total_value,
        "total_leads": total_leads,
        "leads_converted": converted,
        "lead_conversion_rate": conv_rate,
        "avg_deal_value": avg_value,
        "won_cards": len(won_cards),
        "won_value": won_value,
        "win_rate": win_rate,
    }


@router.get("/reports/funnel")
def reports_funnel(db: Session = Depends(get_db)):
    pipelines = db.query(models.Pipeline).all()
    result = []
    for p in pipelines:
        stages_data = []
        for s in sorted(p.stages, key=lambda x: x.order):
            stage_cards = db.query(models.Card).filter(models.Card.stage_id == s.id).all()
            stages_data.append({
                "stage_id": s.id,
                "stage_name": s.name,
                "color": s.color,
                "count": len(stage_cards),
                "value": sum(c.price or 0 for c in stage_cards),
            })
        result.append({
            "pipeline_id": p.id,
            "pipeline_name": p.name,
            "stages": stages_data,
        })
    return result


@router.get("/reports/by-source")
def reports_by_source(db: Session = Depends(get_db)):
    cards = db.query(models.Card).all()
    leads = db.query(models.Lead).all()
    source_map = {}
    for c in cards:
        src = c.source or "Não informado"
        if src not in source_map:
            source_map[src] = {"source": src, "cards": 0, "cards_value": 0, "leads": 0}
        source_map[src]["cards"] += 1
        source_map[src]["cards_value"] += c.price or 0
    for l in leads:
        src = l.source or "Não informado"
        if src not in source_map:
            source_map[src] = {"source": src, "cards": 0, "cards_value": 0, "leads": 0}
        source_map[src]["leads"] += 1
    return sorted(source_map.values(), key=lambda x: x["cards"] + x["leads"], reverse=True)


@router.get("/reports/timeline")
def reports_timeline(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=1) * (i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i == 0:
            month_end = now
        else:
            next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
            month_end = next_month - timedelta(seconds=1)
        cards = db.query(models.Card).filter(
            models.Card.created_at >= month_start,
            models.Card.created_at <= month_end
        ).all()
        leads = db.query(models.Lead).filter(
            models.Lead.created_at >= month_start,
            models.Lead.created_at <= month_end
        ).all() if hasattr(models.Lead, 'created_at') else []
        result.append({
            "month": month_start.strftime("%b/%y"),
            "cards": len(cards),
            "leads": len(leads) if leads else 0,
            "value": sum(c.price or 0 for c in cards),
        })
    return result


@router.get("/reports/by-responsible")
def reports_by_responsible(db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    result = []
    for u in users:
        stmt = select(models.Card).join(models.card_users).where(models.card_users.c.user_id == u.id)
        user_cards = db.execute(stmt).scalars().unique().all()
        total_value = sum(c.price or 0 for c in user_cards)
        result.append({
            "user_id": u.id,
            "user_name": u.name,
            "cards": len(user_cards),
            "value": total_value,
        })
    return sorted(result, key=lambda x: x["value"], reverse=True)


@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    today_str = now.date().isoformat()
    seven_days_ago = now - timedelta(days=7)

    notifications = []

    overdue_tasks = (
        db.query(models.Task)
        .filter(
            models.Task.done == False,
            models.Task.due_date != None,
            models.Task.due_date < today_str,
        )
        .all()
    )
    for task in overdue_tasks:
        notifications.append({
            "id": f"task-{task.id}",
            "type": "overdue_task",
            "title": "Tarefa vencida",
            "body": task.title,
            "card_id": task.card_id,
            "severity": "danger",
            "created_at": task.due_date,
        })

    stalled_cards = (
        db.query(models.Card)
        .filter(
            models.Card.updated_at != None,
            models.Card.updated_at < seven_days_ago,
            models.Card.created_at < seven_days_ago,
        )
        .all()
    )
    for card in stalled_cards:
        notifications.append({
            "id": f"card-{card.id}",
            "type": "stalled_card",
            "title": "Negócio parado",
            "body": f"{card.title} — sem movimentação há mais de 7 dias",
            "card_id": card.id,
            "severity": "warning",
            "created_at": card.updated_at.isoformat(),
        })

    mentions = (
        db.query(models.Activity)
        .filter(
            models.Activity.type == 'note',
            models.Activity.content.contains('@'),
            models.Activity.created_at > seven_days_ago,
        )
        .all()
    )
    for activity in mentions:
        notifications.append({
            "id": f"mention-{activity.id}",
            "type": "mention",
            "title": "Menção em nota",
            "body": activity.content[:80],
            "card_id": activity.card_id,
            "severity": "info",
            "created_at": activity.created_at.isoformat(),
        })

    notifications.sort(key=lambda n: n["created_at"] or "", reverse=True)
    return notifications[:50]


@router.get("/audit-log")
def get_audit_log(
    entity_type: str = "",
    entity_id: int = 0,
    action: str = "",
    actor: str = "",
    date_from: str = "",
    date_to: str = "",
    search: str = "",
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    from datetime import datetime as _dt
    q = db.query(models.AuditLog)
    if entity_type: q = q.filter(models.AuditLog.entity_type == entity_type)
    if entity_id: q = q.filter(models.AuditLog.entity_id == entity_id)
    if action: q = q.filter(models.AuditLog.action == action)
    if actor: q = q.filter(models.AuditLog.actor.ilike(f"%{actor}%"))
    if search: q = q.filter(
        models.AuditLog.entity_name.ilike(f"%{search}%") |
        models.AuditLog.actor.ilike(f"%{search}%") |
        models.AuditLog.details.ilike(f"%{search}%")
    )
    if date_from:
        try:
            q = q.filter(models.AuditLog.created_at >= _dt.fromisoformat(date_from))
        except Exception:
            pass
    if date_to:
        try:
            q = q.filter(models.AuditLog.created_at <= _dt.fromisoformat(date_to + "T23:59:59"))
        except Exception:
            pass
    total = q.count()
    items = q.order_by(models.AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "items": [
            {
                "id": i.id,
                "action": i.action,
                "entity_type": i.entity_type,
                "entity_id": i.entity_id,
                "entity_name": i.entity_name,
                "actor": i.actor,
                "actor_email": i.actor_email,
                "details": i.details,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in items
        ]
    }


@router.get("/search")
def global_search(q: str = "", db: Session = Depends(get_db)):
    if len(q.strip()) < 2:
        return {"cards": [], "leads": [], "contacts": [], "companies": [], "total": 0}

    card_rows = (
        db.query(models.Card, models.Stage)
        .join(models.Stage, models.Card.stage_id == models.Stage.id, isouter=True)
        .filter(
            models.Card.title.ilike(f"%{q}%") |
            models.Card.description.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    cards = [
        {
            "id": card.id,
            "type": "card",
            "title": card.title or "",
            "subtitle": stage.name if stage else "",
            "stage_id": card.stage_id,
            "url": f"#card-{card.id}",
        }
        for card, stage in card_rows
    ]

    lead_rows = (
        db.query(models.Lead)
        .filter(
            models.Lead.title.ilike(f"%{q}%") |
            models.Lead.first_name.ilike(f"%{q}%") |
            models.Lead.last_name.ilike(f"%{q}%") |
            models.Lead.email.ilike(f"%{q}%") |
            models.Lead.phone.ilike(f"%{q}%") |
            models.Lead.company_name.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    leads = []
    for lead in lead_rows:
        name_parts = [p for p in [lead.first_name, lead.last_name] if p]
        title = lead.title or (" ".join(name_parts) if name_parts else f"Lead #{lead.id}")
        subtitle = lead.email or lead.phone or lead.company_name or ""
        leads.append({
            "id": lead.id,
            "type": "lead",
            "title": title,
            "subtitle": subtitle,
            "stage_id": lead.stage_id,
            "url": f"#lead-{lead.id}",
        })

    contact_rows = (
        db.query(models.Contact)
        .filter(
            models.Contact.first_name.ilike(f"%{q}%") |
            models.Contact.last_name.ilike(f"%{q}%") |
            models.Contact.email.ilike(f"%{q}%") |
            models.Contact.phone.ilike(f"%{q}%") |
            models.Contact.company_name.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    contacts = []
    for contact in contact_rows:
        name_parts = [p for p in [contact.first_name, contact.last_name] if p]
        title = " ".join(name_parts) if name_parts else f"Contato #{contact.id}"
        subtitle = contact.email or contact.phone or ""
        contacts.append({
            "id": contact.id,
            "type": "contact",
            "title": title,
            "subtitle": subtitle,
            "url": f"#contact-{contact.id}",
        })

    company_rows = (
        db.query(models.Company)
        .filter(
            models.Company.name.ilike(f"%{q}%") |
            models.Company.company_number.ilike(f"%{q}%")
        )
        .limit(5)
        .all()
    )
    companies = [
        {
            "id": company.id,
            "type": "company",
            "title": company.name or "",
            "subtitle": company.company_number or "",
            "url": f"#company-{company.id}",
        }
        for company in company_rows
    ]

    total = len(cards) + len(leads) + len(contacts) + len(companies)
    return {"cards": cards, "leads": leads, "contacts": contacts, "companies": companies, "total": total}
