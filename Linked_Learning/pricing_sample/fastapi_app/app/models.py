from pydantic import BaseModel
from typing import Optional
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Item(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    price: float
    in_stock: bool = True


class PricingDataSchema(BaseModel):
    id: Optional[int] = None
    store_id: str
    country: str
    sku: str
    product_name: str
    price: float
    date: str


class PricingData(Base):
    __tablename__ = "Pricing_Data"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    store_id = Column(String, nullable=False)
    country = Column(String, nullable=False)
    sku = Column(String, nullable=False)
    product_name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    date = Column(DateTime(timezone=True), nullable=False)
