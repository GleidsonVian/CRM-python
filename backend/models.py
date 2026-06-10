from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Table, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

# Many-to-many junction tables
lead_contacts = Table(
    'lead_contacts', Base.metadata,
    Column('lead_id', Integer, ForeignKey('leads.id', ondelete='CASCADE')),
    Column('contact_id', Integer, ForeignKey('contacts.id', ondelete='CASCADE'))
)

lead_users = Table(
    'lead_users', Base.metadata,
    Column('lead_id', Integer, ForeignKey('leads.id', ondelete='CASCADE')),
    Column('user_id', Integer, ForeignKey('users.id', ondelete='CASCADE'))
)

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

company_contacts = Table(
    'company_contacts', Base.metadata,
    Column('company_id', Integer, ForeignKey('companies.id', ondelete='CASCADE')),
    Column('contact_id', Integer, ForeignKey('contacts.id', ondelete='CASCADE'))
)

class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    company_number = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    company_type = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    annual_revenue = Column(Float, default=0.0)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    messenger = Column(String, nullable=True)
    address = Column(String, nullable=True)
    employees = Column(String, nullable=True)
    available_to_all = Column(Boolean, default=True)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    observers = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    utm_source = Column(String, nullable=True)
    utm_medium = Column(String, nullable=True)
    utm_campaign = Column(String, nullable=True)
    last_contact_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])
    contacts = relationship("Contact", secondary=company_contacts, lazy="joined")

class Webhook(Base):
    __tablename__ = "webhooks"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    type = Column(String, default='outbound')        # 'inbound' | 'outbound'
    token = Column(String, unique=True, index=True)  # secret token (inbound auth / outbound signing)
    url = Column(String, nullable=True)              # outbound: URL to POST to
    events = Column(String, default='[]')            # JSON: ['card.created', 'lead.moved', …]
    allowed_entities = Column(String, default='[]')  # JSON: ['cards','leads','contacts','companies']
    allowed_methods = Column(String, default='["POST"]')  # JSON: ['GET','POST','PUT','DELETE']
    active = Column(Boolean, default=True)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

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
    leads = relationship("Lead", back_populates="stage", cascade="all, delete-orphan")

class Contact(Base):
    __tablename__ = "contacts"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String)
    email = Column(String, index=True)
    cpf = Column(String)
    address = Column(String)
    phone = Column(String)
    salutation = Column(String, nullable=True)
    middle_name = Column(String, nullable=True)
    position = Column(String, nullable=True)
    website = Column(String, nullable=True)
    messenger = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    source = Column(String, nullable=True)
    source_info = Column(String, nullable=True)
    available_to_all = Column(Boolean, default=True)
    included_in_export = Column(Boolean, default=True)
    contact_type = Column(String, nullable=True)
    observers = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    utm_source = Column(String, nullable=True)
    utm_medium = Column(String, nullable=True)
    utm_campaign = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    responsible_user = relationship("User", foreign_keys=[responsible_user_id])

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    role = Column(String, default="vendedor")

class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    type = Column(String)
    content = Column(String)
    actor = Column(String, default='Usuário')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    card = relationship("Card", back_populates="activities", foreign_keys=[card_id])
    lead = relationship("Lead", back_populates="activities", foreign_keys=[lead_id])

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

class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = {'sqlite_autoincrement': True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, index=True)
    description = Column(String, nullable=True)
    price = Column(Float, default=0.0)
    order = Column(Integer, default=0)
    source = Column(String, nullable=True)
    salutation = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    middle_name = Column(String, nullable=True)
    birth_date = Column(String, nullable=True)
    position = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    source_info = Column(String, nullable=True)
    available_to_all = Column(Boolean, default=True)
    address = Column(String, nullable=True)
    utm_source = Column(String, nullable=True)
    utm_medium = Column(String, nullable=True)
    utm_campaign = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    converted = Column(Boolean, default=False)
    converted_card_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    stage_id = Column(Integer, ForeignKey("stages.id"))
    stage = relationship("Stage", back_populates="leads")
    activities = relationship("Activity", back_populates="lead", cascade="all, delete-orphan",
                              foreign_keys="Activity.lead_id")
    contacts = relationship("Contact", secondary=lead_contacts, lazy="joined")
    users = relationship("User", secondary=lead_users, lazy="joined")


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
