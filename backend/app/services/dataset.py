import io
import json
import zipfile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.report import DefectReport
from app.services.s3 import s3_client

class DatasetExportService:
    @staticmethod
    async def create_dataset_zip(db: AsyncSession) -> io.BytesIO:
        # 1. Get all reports
        result = await db.execute(select(DefectReport))
        reports = result.scalars().all()
        
        # 2. Create ZIP in memory
        zip_buffer = io.BytesIO()
        metadata = []
        
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for report in reports:
                try:
                    # Download image from S3
                    file_data = s3_client.get_file(report.photo_url)
                    
                    # Add to ZIP (flat structure or category based)
                    filename = report.photo_url.split("/")[-1]
                    zip_path = f"images/{report.category}/{filename}"
                    zip_file.writestr(zip_path, file_data)
                    
                    # Add to metadata
                    metadata.append({
                        "id": report.id,
                        "category": report.category,
                        "station": report.station,
                        "description": report.description,
                        "latitude": report.latitude,
                        "longitude": report.longitude,
                        "ai_result": report.ai_result,
                        "image_path": zip_path,
                        "created_at": str(report.created_at)
                    })
                except Exception as e:
                    print(f"Error adding report {report.id} to export: {e}")
            
            # Add metadata.json to ZIP
            zip_file.writestr("metadata.json", json.dumps(metadata, indent=4, ensure_ascii=False))
        
        zip_buffer.seek(0)
        return zip_buffer

dataset_export_service = DatasetExportService()
