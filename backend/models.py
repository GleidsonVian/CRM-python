from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
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

class Card(Base):
    __tablename__ = "cards"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    price = Column(Integer, default=0)
    stage_id = Column(Integer, ForeignKey("stages.id"))
    order = Column(Integer, default=0)

    stage = relationship("Stage", back_populates="cards")
