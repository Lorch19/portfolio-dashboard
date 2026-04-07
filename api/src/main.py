import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routers.costs import router as costs_router
from src.routers.debug import router as debug_router
from src.routers.decisions import router as decisions_router
from src.routers.funnel import router as funnel_router
from src.routers.health import router as health_router
from src.routers.holdings import router as holdings_router
from src.routers.performance import router as performance_router
from src.routers.supervisor import router as supervisor_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Validate DB paths at startup
    for label, path in [
        ("portfolio.db", settings.portfolio_db_path),
        ("michael_supervisor.db", settings.supervisor_db_path),
    ]:
        if not path:
            logger.warning("%s path not configured", label)
        elif not Path(path).exists():
            logger.warning("%s not found at %s", label, path)
        else:
            logger.info("%s connected: %s", label, path)
    yield


app = FastAPI(title="Portfolio Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)


app.include_router(costs_router)
app.include_router(debug_router)
app.include_router(decisions_router)
app.include_router(funnel_router)
app.include_router(health_router)
app.include_router(holdings_router)
app.include_router(performance_router)
app.include_router(supervisor_router)


@app.get("/")
def root_ping():
    return {"status": "ok"}
