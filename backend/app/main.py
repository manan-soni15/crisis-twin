from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.db.database import init_db
from backend.app.routers import portfolio, audit, profile, drill, report, stubs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("crisis_twin")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize SQLite database and seed initial data
    logger.info("Starting Crisis Twin backend...")
    init_db()
    logger.info(f"Database ready at: {settings.DATABASE_PATH}")
    yield
    # Shutdown
    logger.info("Shutting down Crisis Twin backend.")

app = FastAPI(
    title="Crisis Twin API",
    description="Backend foundation and API layer for Crisis Twin multi-agent portfolio stress simulator.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health", tags=["system"])
def health_check():
    return {
        "status": "healthy",
        "service": "Crisis Twin API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    }

# Include all feature routers
app.include_router(portfolio.router)
app.include_router(audit.router)
app.include_router(profile.router)
app.include_router(drill.router)
app.include_router(report.router)
app.include_router(stubs.router)
