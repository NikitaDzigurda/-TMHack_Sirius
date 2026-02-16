from sqlalchemy import Column, Integer, String, DateTime, Enum, Float, JSON, Boolean
from sqlalchemy.sql import func
import enum
from app.db.session import Base

class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class DefectReport(Base):
    __tablename__ = "defect_reports"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True)
    station = Column(String, index=True)
    description = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    ai_result = Column(JSON, nullable=True)
    is_synthetic = Column(Boolean, default=False, server_default='false')
    photo_url = Column(String)
    status = Column(String, default=ReportStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
