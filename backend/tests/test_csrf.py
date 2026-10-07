import pytest

from app.config import settings
from app.csrf import is_cross_site


HOST = "acta.example"


@pytest.mark.parametrize(
    ("headers", "cross"),
    [
        ({}, False),
        ({"sec-fetch-site": "same-origin"}, False),
        ({"sec-fetch-site": "none"}, False),
        ({"sec-fetch-site": "same-site"}, True),
        ({"sec-fetch-site": "cross-site"}, True),
        # Fetch metadata wins over an Origin that would look fine on its own.
        ({"sec-fetch-site": "cross-site", "origin": f"https://{HOST}"}, True),
        ({"origin": f"https://{HOST}"}, False),
        ({"origin": "https://evil.example"}, True),
        ({"origin": f"https://other.{HOST}"}, True),
        ({"origin": "null"}, True),
    ],
)
def test_is_cross_site(headers, cross) -> None:
    assert is_cross_site({"host": HOST, **headers}) is cross


def test_an_origin_is_compared_with_this_request_host() -> None:
    assert is_cross_site({"host": "elsewhere.example", "origin": f"https://{HOST}"}) is True
    assert is_cross_site({"origin": f"https://{HOST}"}) is True


def test_a_configured_cors_origin_is_not_cross_site(monkeypatch) -> None:
    monkeypatch.setattr(settings, "CORS_ALLOW_ORIGINS", ["https://app.example"])
    assert is_cross_site({"host": HOST, "origin": "https://app.example", "sec-fetch-site": "cross-site"}) is False
    assert is_cross_site({"host": HOST, "origin": "https://other.example", "sec-fetch-site": "cross-site"}) is True


@pytest.mark.parametrize("site", ["cross-site", "same-site"])
async def test_a_write_from_another_site_is_refused(authed_client, board, site) -> None:
    response = await authed_client.post("/api/boards", json={"name": "Planted"}, headers={"sec-fetch-site": site})
    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-site request refused."
    assert [each["name"] for each in (await authed_client.get("/api/boards")).json()] == ["My board"]


async def test_logging_in_from_another_site_is_refused(client) -> None:
    response = await client.post(
        "/api/auth/login", json={"email": "a@b.c", "password": "x"}, headers={"origin": "https://evil.example"}
    )
    assert response.status_code == 403


async def test_reads_and_same_origin_writes_go_through(authed_client) -> None:
    assert (await authed_client.get("/api/boards", headers={"sec-fetch-site": "cross-site"})).status_code == 200
    same = await authed_client.post("/api/boards", json={"name": "Mine"}, headers={"sec-fetch-site": "same-origin"})
    assert same.status_code == 201
    host = await authed_client.post("/api/boards", json={"name": "Also"}, headers={"origin": "http://testserver.local"})
    assert host.status_code == 201
