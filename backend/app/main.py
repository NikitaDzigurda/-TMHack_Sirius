from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
import asyncio
import random

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.websocket("/ws/ai-status")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Simulate AI processing status updates
            data = {"status": "processing", "progress": random.randint(0, 100)}
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except Exception:
        print("Client disconnected")

@app.get("/")
def root():
    return {"message": "Welcome to MetroAI Backend"}
