import asyncio

import app.main as main_module
from app.config import settings


async def test_health_endpoint(client) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_build_cors_config_is_none_without_allowed_origins(monkeypatch) -> None:
    monkeypatch.setattr(settings, "CORS_ALLOW_ORIGINS", [])
    assert main_module._build_cors_config() is None


def test_build_cors_config_allows_credentials_for_listed_origins(monkeypatch) -> None:
    monkeypatch.setattr(settings, "CORS_ALLOW_ORIGINS", ["http://localhost:5173"])
    cors = main_module._build_cors_config()
    assert cors.allow_origins == ["http://localhost:5173"]
    assert cors.allow_credentials is True


def test_static_router_is_added_only_when_the_build_is_present(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(main_module, "STATIC_DIR", tmp_path / "missing")
    without = main_module._build_route_handlers()
    monkeypatch.setattr(main_module, "STATIC_DIR", tmp_path)
    with_static = main_module._build_route_handlers()
    assert len(with_static) == len(without) + 1
    assert with_static[:-1] == without


async def test_static_build_is_served_at_the_root(tmp_path, monkeypatch) -> None:
    from litestar import Litestar
    from litestar.testing import AsyncTestClient

    (tmp_path / "index.html").write_text("<p>acta</p>")
    monkeypatch.setattr(main_module, "STATIC_DIR", tmp_path)
    async with AsyncTestClient(app=Litestar(route_handlers=main_module._build_route_handlers())) as test_client:
        response = await test_client.get("/")
    assert response.text == "<p>acta</p>"


async def test_reminder_lifespan_does_nothing_when_disabled(monkeypatch) -> None:
    started = []
    monkeypatch.setattr(settings, "REMINDER_INTERVAL_SECONDS", 0)
    monkeypatch.setattr(main_module, "run_reminders", lambda interval: started.append(interval))
    async with main_module.reminder_lifespan(None):
        pass
    assert started == []


async def test_reminder_lifespan_runs_the_loop_and_cancels_it_on_shutdown(monkeypatch) -> None:
    events = []

    async def fake_loop(interval):
        events.append(("started", interval))
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            events.append(("cancelled", interval))
            raise

    monkeypatch.setattr(settings, "REMINDER_INTERVAL_SECONDS", 45)
    monkeypatch.setattr(main_module, "run_reminders", fake_loop)
    async with main_module.reminder_lifespan(None):
        await asyncio.sleep(0)
        assert events == [("started", 45)]
    assert events == [("started", 45), ("cancelled", 45)]
