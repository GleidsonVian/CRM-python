from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    sku: Optional[str] = None
    price: float = 0.0
    type: str = "product"
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None

class Product(ProductBase):
    id: int
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class CardProductBase(BaseModel):
    product_id: int
    quantity: float = 1.0
    unit_price: float = 0.0
    discount: float = 0.0

class CardProductCreate(CardProductBase):
    pass

class CardProductUpdate(BaseModel):
    quantity: Optional[float] = None
    unit_price: Optional[float] = None
    discount: Optional[float] = None

class CardProduct(CardProductBase):
    id: int
    card_id: int
    total_price: float = 0.0
    product: Optional[Product] = None
    
    model_config = ConfigDict(from_attributes=True)
