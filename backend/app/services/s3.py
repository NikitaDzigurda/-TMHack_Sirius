from minio import Minio
from app.core.config import settings
import io
import uuid
from datetime import datetime

class S3Service:
    def __init__(self):
        self.client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket()

    def _ensure_bucket(self):
        if not self.client.bucket_exists(self.bucket_name):
            self.client.make_bucket(self.bucket_name)

    def upload_file(self, file_data: bytes, filename: str, category: str) -> str:
        date_str = datetime.now().strftime("%Y-%m-%d")
        # Structure: /datasets/{category}/{date}/{uuid}_{filename}
        object_name = f"datasets/{category}/{date_str}/{uuid.uuid4()}_{filename}"
        
        self.client.put_object(
            self.bucket_name,
            object_name,
            io.BytesIO(file_data),
            len(file_data),
        )
        return object_name

    def get_file(self, object_name: str) -> bytes:
        response = self.client.get_object(self.bucket_name, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

s3_client = S3Service()
