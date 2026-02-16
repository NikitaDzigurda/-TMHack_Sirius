from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ReportBase(BaseModel):
    category: str
    station: Optional[str] = None
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ReportCreate(ReportBase):
    pass

class Report(ReportBase):
    id: int
    photo_url: str
    ai_result: Optional[dict] = None
    is_synthetic: bool = False
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
