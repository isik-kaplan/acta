from sqlalchemy import select

from app.db import session_factory
from app.models import User
from tests.conftest import PASSWORD, register


async def test_register_creates_a_user_a_session_and_a_starter_board(client) -> None:
    response = await client.post(
        "/api/auth/register",
        json={"email": "  Ada@Acta.Local ", "password": PASSWORD, "display_name": "  Ada  "},
    )
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "email", "display_name"}
    assert body["email"] == "ada@acta.local"
    assert body["display_name"] == "Ada"

    me = await client.get("/api/auth/me")
    assert me.json() == body

    boards = (await client.get("/api/boards")).json()
    assert [each["name"] for each in boards] == ["My board"]
    detail = (await client.get(f"/api/boards/{boards[0]['id']}")).json()
    assert [(column["name"], column["position"]) for column in detail["columns"]] == [
        ("To do", 0),
        ("Doing", 1),
        ("Done", 2),
    ]


async def test_register_rejects_a_duplicate_email_whatever_its_case(client) -> None:
    await register(client)
    response = await client.post(
        "/api/auth/register", json={"email": "ADA@acta.local", "password": PASSWORD, "display_name": "Ada"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "An account with this email already exists."


async def test_register_rejects_a_short_password(client) -> None:
    response = await client.post(
        "/api/auth/register", json={"email": "a@b.c", "password": "1234567", "display_name": "Ada"}
    )
    assert response.status_code == 400


async def test_register_accepts_an_eight_character_password(client) -> None:
    response = await client.post(
        "/api/auth/register", json={"email": "a@b.c", "password": "12345678", "display_name": "Ada"}
    )
    assert response.status_code == 201


async def test_register_is_not_found_while_registration_is_disabled(client, monkeypatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "REGISTRATION_ENABLED", False)
    response = await client.post(
        "/api/auth/register", json={"email": "a@b.c", "password": PASSWORD, "display_name": "Ada"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Registration is currently disabled."
    async with session_factory() as db_session:
        assert list(await db_session.scalars(select(User))) == []


async def test_login_matches_email_case_insensitively(client) -> None:
    await register(client)
    await client.post("/api/auth/logout")

    response = await client.post("/api/auth/login", json={"email": " ADA@acta.local", "password": PASSWORD})
    assert response.status_code == 201
    assert response.json()["email"] == "ada@acta.local"
    assert (await client.get("/api/auth/me")).status_code == 200


async def test_login_rejects_a_wrong_password(client) -> None:
    await register(client)
    await client.post("/api/auth/logout")
    response = await client.post("/api/auth/login", json={"email": "ada@acta.local", "password": "wrong-password"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_login_rejects_an_unknown_email(client) -> None:
    response = await client.post("/api/auth/login", json={"email": "nobody@acta.local", "password": PASSWORD})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password."


async def test_logout_clears_the_session(authed_client) -> None:
    response = await authed_client.post("/api/auth/logout")
    assert response.status_code == 204
    assert (await authed_client.get("/api/auth/me")).status_code == 401


async def test_me_requires_a_session(client) -> None:
    assert (await client.get("/api/auth/me")).status_code == 401
