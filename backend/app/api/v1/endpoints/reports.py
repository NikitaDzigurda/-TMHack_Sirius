from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from app.db.session import get_db
from app.models.report import DefectReport, ReportStatus
from app.schemas.report import Report
from app.services.s3 import s3_client
from app.services.dataset import dataset_export_service
from app.worker import process_report_task

router = APIRouter()

@router.post("/", response_model=List[Report])
async def create_reports(
    category: str = Form(...),
    station: str = Form(None),
    description: str = Form(None),
    latitude: float = Form(None),
    longitude: float = Form(None),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    try:
        created_reports = []
        for file in files:
            file_content = await file.read()
            object_name = s3_client.upload_file(file_content, file.filename, category)
            
            db_report = DefectReport(
                category=category,
                station=station,
                description=description,
                latitude=latitude,
                longitude=longitude,
                photo_url=object_name,
                status=ReportStatus.PENDING
            )
            db.add(db_report)
            await db.flush() # Get ID without committing yet
            
            # Trigger AI processing task
            process_report_task.delay(db_report.id)
            created_reports.append(db_report)
        
        await db.commit()
        for report in created_reports:
            await db.refresh(report)
            
        return created_reports

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[Report])
async def list_reports(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(DefectReport)
    if category:
        query = query.where(DefectReport.category == category)
    if status:
        query = query.where(DefectReport.status == status)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{report_id}", response_model=Report)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(DefectReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@router.get("/export/zip")
async def export_dataset(
    db: AsyncSession = Depends(get_db),
):
    """
    Export all reports and their images into a ZIP archive.
    """
    zip_buffer = await dataset_export_service.create_dataset_zip(db)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": "attachment; filename=metroai_dataset.zip"}
    )
