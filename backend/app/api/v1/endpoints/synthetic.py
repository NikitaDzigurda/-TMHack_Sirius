from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.synthetic import synthetic_generator

router = APIRouter()

@router.post("/generate")
async def generate_synthetic_data(
    count: int = Query(default=100, ge=1, le=1000, description="Number of synthetic reports to generate"),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate synthetic defect reports for training ML models.
    Creates fake images using image augmentation techniques.
    """
    reports = await synthetic_generator.generate_batch(db, count)
    
    return {
        "status": "success",
        "generated_count": len(reports),
        "message": f"Successfully generated {len(reports)} synthetic reports"
    }
