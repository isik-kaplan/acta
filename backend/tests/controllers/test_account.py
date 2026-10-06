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
