import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from litestar import Litestar, get
from litestar.config.cors import CORSConfig
from litestar.di import Provide
from litestar.static_files import create_static_files_router

from app.auth import session_auth
from app.config import settings
from app.controllers.account import account_router
from app.controllers.auth import auth_router
from app.controllers.boards import boards_router
from app.controllers.cards import cards_router
from app.controllers.columns import columns_router
from app.controllers.push import push_router
from app.db import create_tables, get_db_session
from app.services.reminders import run_reminders


STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


def _build_route_handlers() -> list:
    handlers = [health, auth_router, account_router, boards_router, columns_router, cards_router, push_router]
    if STATIC_DIR.is_dir():
        # The built SPA, only present once the frontend build has been copied in. In the Docker
        # image nginx serves it instead (docker/nginx.conf); this is for running the backend alone.
        handlers.append(create_static_files_router(path="/", directories=[STATIC_DIR], html_mode=True))
    return handlers


def _build_cors_config() -> CORSConfig | None:
    if not settings.CORS_ALLOW_ORIGINS:
        return None
    return CORSConfig(allow_origins=settings.CORS_ALLOW_ORIGINS, allow_credentials=True)


@asynccontextmanager
async def reminder_lifespan(_: Litestar) -> AsyncIterator[None]:
    # An interval of 0 turns the loop off - the test suite does, so no pass races its fixtures.
    if settings.REMINDER_INTERVAL_SECONDS <= 0:
        yield
        return
    task = asyncio.create_task(run_reminders(settings.REMINDER_INTERVAL_SECONDS))
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = Litestar(
    route_handlers=_build_route_handlers(),
    dependencies={"db_session": Provide(get_db_session)},
    on_app_init=[session_auth.on_app_init],
    on_startup=[create_tables],
    lifespan=[reminder_lifespan],
    cors_config=_build_cors_config(),
)
