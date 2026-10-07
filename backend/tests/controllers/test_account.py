from litestar.testing import AsyncTestClient

from app.main import app
from tests.conftest import PASSWORD


async def test_change_password_then_log_in_with_the_new_one(authed_client) -> None:
    response = await authed_client.post(
        "/api/account/password", json={"current_password": PASSWORD, "new_password": "a-brand-new-one"}
    )
    assert response.status_code == 204

    await authed_client.post("/api/auth/logout")
    old = await authed_client.post("/api/auth/login", json={"email": "ada@acta.local", "password": PASSWORD})
    assert old.status_code == 401
    new = await authed_client.post("/api/auth/login", json={"email": "ada@acta.local", "password": "a-brand-new-one"})
    assert new.status_code == 201


async def test_change_password_needs_the_current_one(authed_client) -> None:
    response = await authed_client.post(
        "/api/account/password", json={"current_password": "not-it", "new_password": "a-brand-new-one"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Current password is incorrect."
    await authed_client.post("/api/auth/logout")
    still = await authed_client.post("/api/auth/login", json={"email": "ada@acta.local", "password": PASSWORD})
    assert still.status_code == 201


async def test_change_password_rejects_a_short_new_one(authed_client) -> None:
    response = await authed_client.post(
        "/api/account/password", json={"current_password": PASSWORD, "new_password": "short"}
    )
    assert response.status_code == 400


async def test_changing_the_password_signs_out_every_other_device(authed_client) -> None:
    async with AsyncTestClient(app=app) as other_device:
        login = await other_device.post("/api/auth/login", json={"email": "ada@acta.local", "password": PASSWORD})
        assert login.status_code == 201
        assert (await other_device.get("/api/auth/me")).status_code == 200

        await authed_client.post(
            "/api/account/password", json={"current_password": PASSWORD, "new_password": "a-brand-new-one"}
        )
        assert (await other_device.get("/api/auth/me")).status_code == 401
    # The device that made the change stays signed in.
    assert (await authed_client.get("/api/auth/me")).status_code == 200
