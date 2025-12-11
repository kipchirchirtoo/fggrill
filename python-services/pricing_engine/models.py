from pydantic import BaseModel
from typing import List, Optional
from datetime import date

class PricingRequest(BaseModel):
    check_in: date
    check_out: date
    room_type_id: str
    guests: int

class PricingResponse(BaseModel):
    base_price: float
    recommended_price: float
    multiplier: float
    factors: List[str]
    rate_plan_id: Optional[str] = None

class OccupancyData(BaseModel):
    date: date
    occupancy_rate: float
