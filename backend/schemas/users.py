from typing import Optional
from pydantic import BaseModel


class UserBase(BaseModel):
    name: str
    email: str
    role: str = "vendedor"
    role_id: Optional[int] = None


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    is_active: bool = True

    class Config:
        from_attributes = True
