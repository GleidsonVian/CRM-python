from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Table, Boolean
from sqlalchemy.types import JSON
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
    events = Column(JSON, default=list)
    allowed_entities = Column(JSON, default=list)
    allowed_methods = Column(JSON, default=lambda: ["POST"])
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

class Role(Base):
    __tablename__ = "roles"
    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name        = Column(String, nullable=False)
    description = Column(String, default='')
    color       = Column(String, default='#6366f1')
    permissions = Column(JSON, default=dict)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    members     = relationship("User", back_populates="crm_role", foreign_keys="User.role_id")

class User(Base):
    __tablename__ = "users"
    id       = Column(Integer, primary_key=True, index=True)
    name     = Column(String, index=True)
    email    = Column(String, unique=True, index=True)
    role     = Column(String, default="vendedor")   # 'admin' | 'user' — kept for auth
    role_id  = Column(Integer, ForeignKey("roles.id", ondelete="SET NULL"), nullable=True)
    password_hash = Column(String, nullable=True)
    is_active     = Column(Boolean, default=True)
    crm_role      = relationship("Role", back_populates="members", foreign_keys=[role_id])

class Activity(Base):
    __tablename__ = "activities"
    id = Column(Integer, primary_key=True, index=True)
    card_id = Column(Integer, ForeignKey("cards.id"), nullable=True, index=True)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True, index=True)
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
    entity_type = Column(String, default='deal')  # 'deal' | 'lead' | 'any'
    name = Column(String, default="Regra")
    action_type = Column(String)  # webhook | assign_user | add_note | set_price
    config = Column(JSON, default=dict)
    order = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    entity_type = Column(String, default='deal')  # 'deal' | 'lead' | 'any'

class CustomField(Base):
    __tablename__ = "custom_fields"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    uid = Column(String, default='')        # e.g. NGS-001, CTT-002, EQP-003
    entity = Column(String, index=True)    # 'deal', 'contact', 'user'
    name = Column(String)
    key = Column(String)                   # snake_case machine key
    field_type = Column(String, default='text')  # text, number, select, date, checkbox, textarea, url, phone, email, currency, attachment
    options = Column(JSON, default=list)
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

class Project(Base):
    __tablename__ = "projects"
    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name        = Column(String, nullable=False)
    description = Column(String, default='')
    icon        = Column(String, default='📁')
    theme_color = Column(String, default='#6366f1')
    privacy     = Column(String, default='public')   # public | private | hidden
    owner_id    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    owner       = relationship("User", foreign_keys=[owner_id])
    members     = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks       = relationship("Task", back_populates="project", foreign_keys="Task.project_id")

class ProjectMember(Base):
    __tablename__ = "project_members"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role       = Column(String, default='member')   # owner | moderator | member
    project    = relationship("Project", back_populates="members")
    user       = relationship("User")

class Team(Base):
    __tablename__ = "teams"
    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name        = Column(String, nullable=False)
    description = Column(String, default='')
    permissions = Column(JSON, default=list)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    members     = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")

class TeamMember(Base):
    __tablename__ = "team_members"
    id      = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    role    = Column(String, default='member')   # manager | member
    team    = relationship("Team", back_populates="members")
    user    = relationship("User")

class Task(Base):
    __tablename__ = "tasks"
    id             = Column(Integer, primary_key=True, index=True, autoincrement=True)
    uid            = Column(String, default='')         # TSK-001
    title          = Column(String, nullable=False)
    description    = Column(String, default='')
    status         = Column(String, default='todo')     # todo | in_progress | done
    priority       = Column(String, default='normal')   # low | normal | high | urgent
    due_date       = Column(String, default=None)       # YYYY-MM-DD
    assigned_to    = Column(String, default='')
    participants   = Column(JSON, default=list)
    done           = Column(Boolean, default=False)
    card_id        = Column(Integer, ForeignKey("cards.id", ondelete="SET NULL"), nullable=True)
    lead_id        = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    project_id     = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    parent_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), nullable=True)
    project        = relationship("Project", back_populates="tasks", foreign_keys=[project_id])
    subtasks       = relationship("Task", foreign_keys=[parent_task_id],
                                  backref="parent_task", remote_side=[id], lazy="select",
                                  primaryjoin="Task.parent_task_id==Task.id")
    time_entries   = relationship("TaskTimeEntry", back_populates="task",
                                  cascade="all, delete-orphan")

class TaskTimeEntry(Base):
    __tablename__ = "task_time_entries"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    task_id          = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"))
    user_name        = Column(String, default='')
    started_at       = Column(DateTime(timezone=True), nullable=True)
    ended_at         = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, default=0)  # filled on stop
    task             = relationship("Task", back_populates="time_entries")

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

    deleted_at = Column(DateTime, nullable=True)

    stage_id = Column(Integer, ForeignKey("stages.id"), index=True)
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
    updated_at = Column(DateTime(timezone=True), nullable=True)
    stage_changed_by = Column(String, nullable=True)

    deleted_at = Column(DateTime, nullable=True)

    stage_id = Column(Integer, ForeignKey("stages.id"), index=True)
    # Legacy single FK kept for migration compatibility (not used in API)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    source = Column(String, nullable=True)
    source_info = Column(String, nullable=True)
    deal_type = Column(String, nullable=True)
    start_date = Column(String, nullable=True)
    available_to_all = Column(Boolean, default=True)
    responsible_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    observers = Column(String, nullable=True)
    comment = Column(String, nullable=True)
    utm_source = Column(String, nullable=True)
    utm_medium = Column(String, nullable=True)
    utm_campaign = Column(String, nullable=True)

    stage = relationship("Stage", back_populates="cards")
    activities = relationship("Activity", back_populates="card", cascade="all, delete-orphan")
    contacts = relationship("Contact", secondary=card_contacts, lazy="joined")
    users = relationship("User", secondary=card_users, lazy="joined")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    action = Column(String, nullable=False)          # "created" | "updated" | "deleted" | "moved" | "converted" | "login"
    entity_type = Column(String, nullable=False)     # "card" | "lead" | "contact" | "company" | "user" | "pipeline"
    entity_id = Column(Integer, nullable=True, index=True)
    entity_name = Column(String, nullable=True)      # e.g. card title at time of action
    actor = Column(String, nullable=False, default="Sistema")  # user name or "Sistema"
    actor_email = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WebhookLog(Base):
    __tablename__ = "webhook_logs"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    webhook_id = Column(Integer, ForeignKey("webhooks.id", ondelete="CASCADE"))
    event = Column(String, nullable=True)       # e.g. "card.created" or "test"
    status_code = Column(Integer, nullable=True)
    response_body = Column(String, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    success = Column(Boolean, default=False)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class StageRequiredField(Base):
    __tablename__ = "stage_required_fields"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    stage_id       = Column(Integer, ForeignKey("stages.id", ondelete="CASCADE"))
    field_type     = Column(String)           # 'builtin' or 'custom'
    field_key      = Column(String, nullable=True)   # for builtin: 'price','contact','responsible','description','source'
    custom_field_id = Column(Integer, ForeignKey("custom_fields.id", ondelete="CASCADE"), nullable=True)

class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    name        = Column(String)
    description = Column(String, default='')
    entity_type = Column(String, default='deal')   # 'deal' | 'lead' | 'any'
    pipeline_id = Column(Integer, ForeignKey("pipelines.id", ondelete="SET NULL"), nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    steps       = relationship("WorkflowStep", back_populates="template",
                               cascade="all, delete-orphan", order_by="WorkflowStep.step_order")

class WorkflowStep(Base):
    __tablename__ = "workflow_steps"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    template_id   = Column(Integer, ForeignKey("workflow_templates.id", ondelete="CASCADE"))
    step_order    = Column(Integer, default=0)
    action_type   = Column(String)   # 'change_stage'|'assign_user'|'add_note'|'send_webhook'|'move_to_pipeline'|'set_price'
    action_config = Column(JSON, default=dict)
    template      = relationship("WorkflowTemplate", back_populates="steps")

class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    template_id      = Column(Integer, ForeignKey("workflow_templates.id", ondelete="SET NULL"), nullable=True)
    template_name    = Column(String, default='')
    card_id          = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"))
    executed_by_id   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    executed_by_name = Column(String, default='')
    executed_at      = Column(DateTime(timezone=True), server_default=func.now())
    status           = Column(String, default='completed')   # 'completed' | 'failed'
    result_log       = Column(JSON, default=list)

