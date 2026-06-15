from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, field_validator
from .common import coerce_json_str


class AutomationRuleBase(BaseModel):
    stage_id: int
    pipeline_id: int
    name: str = "Regra"
    action_type: str
    config: Dict[str, Any] = {}
    order: int = 0
    enabled: bool = True
    entity_type: str = 'deal'

    @field_validator('config', mode='before')
    @classmethod
    def _coerce_config(cls, v):
        return coerce_json_str(v, dict)


class AutomationRuleCreate(AutomationRuleBase):
    pass


class AutomationRule(AutomationRuleBase):
    id: int

    class Config:
        from_attributes = True


class WorkflowStepBase(BaseModel):
    step_order: int = 0
    action_type: str
    action_config: Dict[str, Any] = {}

    @field_validator('action_config', mode='before')
    @classmethod
    def _coerce_action_config(cls, v):
        return coerce_json_str(v, dict)


class WorkflowStepCreate(WorkflowStepBase):
    pass


class WorkflowStep(WorkflowStepBase):
    id: int
    template_id: int

    class Config:
        from_attributes = True


class WorkflowTemplateBase(BaseModel):
    name: str
    description: str = ''
    entity_type: str = 'deal'
    pipeline_id: Optional[int] = None
    is_active: bool = True


class WorkflowTemplateCreate(WorkflowTemplateBase):
    steps: List[WorkflowStepBase] = []


class WorkflowTemplate(WorkflowTemplateBase):
    id: int
    created_at: datetime
    steps: List[WorkflowStep] = []

    class Config:
        from_attributes = True


class WorkflowExecutionOut(BaseModel):
    id: int
    template_id: Optional[int]
    template_name: str
    card_id: int
    executed_by_name: str
    executed_at: datetime
    status: str
    result_log: List[Any] = []

    @field_validator('result_log', mode='before')
    @classmethod
    def _coerce_result_log(cls, v):
        return coerce_json_str(v, list)

    class Config:
        from_attributes = True
