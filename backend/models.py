from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Table, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# Many-to-many junction tables
card_contacts = Table(
    'card_contacts', Base.metadata,
    Column('card_id', Integer, ForeignKey('cards.id', ondelete='CASCADE')),
    Column('contact_id', Integer, ForeignKey('contacts.id', ondelete='CASCADE'))
)

card_users = Table(
    'card_users', Base.metadata,
    Column('card_id', Integer, ForeignKey('cards.id', ondelete='CASCADE')),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'))
)

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

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String, default="vendedor")

class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"))
    type = Column(String)
    content = Column(String)
    actor = Column(String, default='Usuário')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    card = relationship("Card", back_populates="activities")

class AutomationRule(Base):
    __tablename__ = "automation_rules"
    id = Column(Integer, primary_key=True, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id", ondelete="CASCADE"))
    pipeline_id = Column(Integer, ForeignKey("pipelines.id", ondelete="CASCADE"))
    name = Column(String, default="Regra")
    action_type = Column(String)  # webhook | assign_user | add_note | set_price
    config = Column(String, default="{}")  # JSON
    order = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)

class CustomField(Base):
    __tablename__ = "custom_fields"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    uid = Column(String, default='')        # e.g. NGS-001, CTT-002, EQP-003
    entity = Column(String, index=True)    # 'deal', 'contact', 'user'
    name = Column(String)
    key = Column(String)                   # snake_case machine key
    field_type = Column(String, default='text')  # text, number, select, date, checkbox, textarea, url, phone, email, currency, attachment
    options = Column(String, default='[]')        # JSON: [{id, label}] for select type
    required = Column(Boolean, default=False)
    show_on_card = Column(Boolean, default=False) # show value on kanban card
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    values = relationship("CustomFieldValue", back_populates="field", cascade="all, delete-orphan")

class CustomFieldValue(Base):
    __tablename__ = "custom_field_values"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    field_id = Column(Integer, ForeignKey("custom_fields.id", ondelete="CASCADE"))
    entity_id = Column(Integer, index=True)   # card.id, contact.id, or user.id
    value = Column(String, default='')
    field = relationship("CustomField", back_populates="values")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"))
    title = Column(String, nullable=False)
    description = Column(String, default='')
    due_date = Column(String, default=None)   # ISO date string YYYY-MM-DD
    assigned_to = Column(String, default='')  # free-text name
    done = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"))
    author = Column(String, default='Usuário')
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Card(Base):
    __tablename__ = "cards"
    __table_args__ = {'sqlite_autoincrement': True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    price = Column(Float, default=0.0)
    order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stage_id = Column(Integer, ForeignKey("stages.id"))
    # Legacy single FK kept for migration compatibility (not used in API)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    stage = relationship("Stage", back_populates="cards")
    activities = relationship("Activity", back_populates="card", cascade="all, delete-orphan")
    contacts = relationship("Contact", secondary=card_contacts, lazy="joined")
    users = relationship("User", secondary=card_users, lazy="joined")
