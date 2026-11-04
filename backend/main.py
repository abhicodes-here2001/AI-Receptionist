import asyncio
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import calls, contacts, onboarding, status
from backend.storage import storage
from backend.voice_relay import voice_websocket
from backend.dashboard_broadcaster import dashboard_websocket

logger = logging.getLogger(__name__)


async def _cleanup_sessions_loop() -> None:
    """Periodically clean expired session windows."""
    while True:
        await asyncio.sleep(300)
        storage.clean_expired_sessions()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_sessions_loop())
    logger.info("AI Receptionist backend started")
    yield
    task.cancel()


app = FastAPI(title="AI Receptionist", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(status.router, prefix="/api")
app.include_router(onboarding.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(calls.router, prefix="/api")

app.websocket("/ws/voice")(voice_websocket)
app.websocket("/ws/dashboard")(dashboard_websocket)

# In production, serve the built Next.js frontend as static files
frontend_build = os.path.join(os.path.dirname(__file__), "..", "frontend", "out")
if os.path.isdir(frontend_build):
    app.mount("/", StaticFiles(directory=frontend_build, html=True), name="frontend")
