from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Pipeline(Base):
    __tablename__ = "pipelines"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    
    stages = relationship("Stage", back_populates="pipeline", cascade="all, delete-orphan")

class Stage(Base):
    __tablename__ = "stages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    order = Column(Integer, default=0)
    color = Column(String, default="#0f6e9f")
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))

    pipeline = relationship("Pipeline", back_populates="stages")
    cards = relationship("Card", back_populates="stage", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String)
    email = Column(String, index=True)
    cpf = Column(String)
    address = Column(String)
    phone = Column(String)

    cards = relationship("Card", back_populates="contact")

class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, sqlite_autoincrement=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    price = Column(Float, default=0.0)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    stage_id = Column(Integer, ForeignKey("stages.id"))
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)

    stage = relationship("Stage", back_populates="cards")
    contact = relationship("Contact", back_populates="cards")
