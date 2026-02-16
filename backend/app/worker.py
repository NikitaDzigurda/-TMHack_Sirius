import asyncio
import time
from celery import Celery
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.report import DefectReport, ReportStatus

celery_app = Celery("worker", broker=settings.CELERY_BROKER_URL, backend=settings.CELERY_RESULT_BACKEND)

async def update_report_status(report_id: int, status: str, ai_result: dict = None):
    async with SessionLocal() as session:
        report = await session.get(DefectReport, report_id)
        if report:
            report.status = status
            if ai_result:
                report.ai_result = ai_result
            await session.commit()

@celery_app.task
def process_report_task(report_id: int):
    # 1. Update status to processing
    asyncio.run(update_report_status(report_id, ReportStatus.PROCESSING))
    
    # 2. Simulate AI Processing
    time.sleep(10)
    
    # 3. Simulated AI Result
    mock_result = {
        "confidence": 0.95,
        "labels": ["dirty_window", "graffiti"],
        "processed_at": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    
    # 4. Update status to completed
    asyncio.run(update_report_status(report_id, ReportStatus.COMPLETED, mock_result))
    
    return {"report_id": report_id, "status": "completed", "result": mock_result}
