import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.logging import setup_logging
from app.modules.fair_stand.api.live_share_routes import live_share_sweep_loop
from app.modules.fair_stand.api.cost_item_routes import router as fair_stand_cost_item_router
from app.modules.fair_stand.api.group_template_routes import router as fair_stand_group_template_router
from app.modules.fair_stand.api.live_share_routes import router as fair_stand_live_share_router
from app.modules.fair_stand.api.project_routes import router as fair_stand_project_router
from app.modules.fair_stand.api.routes import router as fair_stand_router

setup_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(live_share_sweep_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Fair Stand", version="0.1.0", lifespan=lifespan)
app.include_router(fair_stand_router, prefix="/api/v1")
app.include_router(fair_stand_project_router, prefix="/api/v1")
app.include_router(fair_stand_cost_item_router, prefix="/api/v1")
app.include_router(fair_stand_group_template_router, prefix="/api/v1")
app.include_router(fair_stand_live_share_router, prefix="/api/v1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "fair-stand"}
