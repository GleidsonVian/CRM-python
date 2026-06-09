from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from typing import List

import models, schemas
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_default_negocios_stages(db: Session, pipeline_id: int):
    stages = [
        {"name": "Proposta", "color": "#19497a"},
        {"name": "Negociação", "color": "#2bb2e6"},
        {"name": "Em andamento", "color": "#0f6e9f"},
        {"name": "Sucesso", "color": "#11a65a"},
        {"name": "Perdido / Desqualificado", "color": "#b91c1c"}
    ]
    for i, stg in enumerate(stages):
        db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=pipeline_id))
    db.commit()

# ---- Inicialização de Dados Padrão ----
@app.on_event("startup")
def startup_event():
    db = next(get_db())
    if not db.query(models.Pipeline).first():
        p_leads = models.Pipeline(name="Leads")
        p_negocios = models.Pipeline(name="Negócios")
        db.add(p_leads)
        db.add(p_negocios)
        db.commit()
        
        stages_leads = [
            {"name": "Novo Lead", "color": "#22164f"},
            {"name": "Em Contato", "color": "#19497a"},
            {"name": "Qualificação", "color": "#0f6e9f"},
            {"name": "Convertido (Ganho)", "color": "#11a65a"},
            {"name": "Perdido / Desqualificado", "color": "#b91c1c"}
        ]
        for i, stg in enumerate(stages_leads):
            db.add(models.Stage(name=stg["name"], color=stg["color"], order=i, pipeline_id=p_leads.id))
            
        create_default_negocios_stages(db, p_negocios.id)

# ---- Rotas Pipelines ----
@app.get("/pipelines", response_model=List[schemas.Pipeline])
def get_pipelines(db: Session = Depends(get_db)):
    return db.query(models.Pipeline).all()

@app.post("/pipelines", response_model=schemas.Pipeline)
def create_pipeline(pipeline: schemas.PipelineCreate, db: Session = Depends(get_db)):
    db_pipe = models.Pipeline(name=pipeline.name)
    db.add(db_pipe)
    db.commit()
    db.refresh(db_pipe)
    create_default_negocios_stages(db, db_pipe.id)
    return db_pipe

@app.put("/pipelines/{pipe_id}", response_model=schemas.Pipeline)
def update_pipeline(pipe_id: int, pipeline_data: schemas.PipelineCreate, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    # Não permitir renomear os padrões para evitar quebra de lógica
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido renomear os funis padrão.")
    pipe.name = pipeline_data.name
    db.commit()
    db.refresh(pipe)
    return pipe

@app.delete("/pipelines/{pipe_id}")
def delete_pipeline(pipe_id: int, db: Session = Depends(get_db)):
    pipe = db.query(models.Pipeline).filter(models.Pipeline.id == pipe_id).first()
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipe.name in ["Leads", "Negócios"]:
        raise HTTPException(status_code=400, detail="Não é permitido excluir os funis padrão (Leads e Negócios).")
    
    db.delete(pipe)
    db.commit()
    return {"status": "ok"}

# ---- Rotas Stages ----
@app.get("/stages", response_model=List[schemas.Stage])
def get_stages(pipeline_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Stage)
    if pipeline_id:
        query = query.filter(models.Stage.pipeline_id == pipeline_id)
    return query.order_by(models.Stage.order).all()

@app.post("/stages", response_model=schemas.Stage)
def create_stage(stage: schemas.StageCreate, db: Session = Depends(get_db)):
    db_stage = models.Stage(**stage.dict())
    db.add(db_stage)
    db.commit()
    db.refresh(db_stage)
    return db_stage

@app.put("/stages/{stage_id}", response_model=schemas.Stage)
def update_stage(stage_id: int, stage_data: schemas.StageCreate, db: Session = Depends(get_db)):
    stg = db.query(models.Stage).filter(models.Stage.id == stage_id).first()
    if not stg:
        raise HTTPException(status_code=404, detail="Stage not found")
    stg.name = stage_data.name
    stg.color = stage_data.color
    db.commit()
    db.refresh(stg)
    return stg

# ---- Rotas Contacts ----
@app.get("/contacts", response_model=List[schemas.Contact])
def get_contacts(db: Session = Depends(get_db)):
    return db.query(models.Contact).all()

@app.post("/contacts", response_model=schemas.Contact)
def create_contact(contact: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = models.Contact(**contact.dict())
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    return db_contact

@app.put("/contacts/{contact_id}", response_model=schemas.Contact)
def update_contact(contact_id: int, contact_data: schemas.ContactCreate, db: Session = Depends(get_db)):
    db_contact = db.query(models.Contact).filter(models.Contact.id == contact_id).first()
    if not db_contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    
    for key, value in contact_data.dict().items():
        setattr(db_contact, key, value)
        
    db.commit()
    db.refresh(db_contact)
    return db_contact

# ---- Rotas Cards ----
@app.get("/cards", response_model=List[schemas.Card])
def get_cards(pipeline_id: int = None, contact_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Card)
    if pipeline_id:
        query = query.join(models.Stage).filter(models.Stage.pipeline_id == pipeline_id)
    if contact_id:
        query = query.filter(models.Card.contact_id == contact_id)
    return query.all()

@app.post("/cards", response_model=schemas.Card)
def create_card(card: schemas.CardCreate, db: Session = Depends(get_db)):
    card_dict = card.dict(exclude_unset=True)
    if "created_at" in card_dict and card_dict["created_at"] is None:
        del card_dict["created_at"]
    db_card = models.Card(**card_dict)
    db.add(db_card)
    db.commit()
    db.refresh(db_card)
    return db_card

@app.get("/cards/{card_id}", response_model=schemas.Card)
def get_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card

@app.put("/cards/{card_id}", response_model=schemas.Card)
def update_card(card_id: int, card_data: schemas.CardBase, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card.title = card_data.title
    card.description = card_data.description
    card.price = card_data.price
    card.stage_id = card_data.stage_id
    card.contact_id = card_data.contact_id
    db.commit()
    db.refresh(card)
    return card

@app.put("/cards/{card_id}/move", response_model=schemas.Card)
def move_card(card_id: int, move_data: schemas.CardMove, db: Session = Depends(get_db)):
    card = db.query(models.Card).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    new_stage = db.query(models.Stage).filter(models.Stage.id == move_data.new_stage_id).first()
    if not new_stage:
        raise HTTPException(status_code=404, detail="Stage not found")
        
    card.stage_id = new_stage.id
    card.order = move_data.new_order
    db.commit()
    db.refresh(card)
    
    # AUTOMAÇÃO DE CONVERSÃO
    if new_stage.name == "Convertido (Ganho)":
        pipeline_negocios = db.query(models.Pipeline).filter(models.Pipeline.name == "Negócios").first()
        if pipeline_negocios:
            first_stage_negocios = db.query(models.Stage).filter(models.Stage.pipeline_id == pipeline_negocios.id).order_by(models.Stage.order).first()
            if first_stage_negocios:
                clone_card = models.Card(
                    title=card.title,
                    description=card.description,
                    price=card.price,
                    stage_id=first_stage_negocios.id,
                    order=0
                )
                db.add(clone_card)
                db.commit()
    
    return card
