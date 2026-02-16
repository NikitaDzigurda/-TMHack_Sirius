from fastapi import APIRouter
from app.api.v1.endpoints import reports, synthetic

api_router = APIRouter()
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(synthetic.router, prefix="/synthetic", tags=["synthetic"])
