import pytest
from sqlalchemy import select

from app.controllers.push import is_push_service
from app.db import session_factory
from app.models import PushSubscription
from app.services import push


SUBSCRIPTION = {
    "endpoint": "https://fcm.googleapis.com/fcm/send/device-1",
    "keys": {"p256dh": "key-1", "auth": "auth-1"},
}


async def stored() -> list[tuple[str, str, str]]:
    async with session_factory() as db_session:
        rows = await db_session.scalars(select(PushSubscription).order_by(PushSubscription.endpoint))
        return [(row.endpoint, row.p256dh, row.auth) for row in rows]


@pytest.fixture
def delivered(monkeypatch) -> list[tuple[str, dict]]:
    sent = []

    def fake_deliver(subscription, payload) -> bool:
        sent.append((subscription.endpoint, payload))
        return "gone" not in subscription.endpoint

    monkeypatch.setattr(push, "deliver", fake_deliver)
    return sent


async def test_public_key_is_the_servers_vapid_key(authed_client, monkeypatch) -> None:
    from app.services.vapid import VapidKeys

    monkeypatch.setattr("app.controllers.push.vapid_keys", lambda: VapidKeys(private_key="priv", public_key="pub"))
    response = await authed_client.get("/api/push/public-key")
    assert response.status_code == 200
    assert response.json() == {"public_key": "pub"}


async def test_push_requires_a_session(client) -> None:
    assert (await client.post("/api/push/subscriptions", json=SUBSCRIPTION)).status_code == 401


async def test_subscribe_stores_the_device_once_and_updates_its_keys(authed_client) -> None:
    response = await authed_client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    assert response.status_code == 204
    assert await stored() == [("https://fcm.googleapis.com/fcm/send/device-1", "key-1", "auth-1")]

    renewed = {**SUBSCRIPTION, "keys": {"p256dh": "key-2", "auth": "auth-2"}}
    await authed_client.post("/api/push/subscriptions", json=renewed)
    assert await stored() == [("https://fcm.googleapis.com/fcm/send/device-1", "key-2", "auth-2")]


async def test_a_device_follows_whoever_subscribed_it_last(authed_client, other_client, delivered) -> None:
    await authed_client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    await other_client.post("/api/push/subscriptions", json=SUBSCRIPTION)

    assert (await authed_client.post("/api/push/test")).json() == {"sent": 0}
    assert (await other_client.post("/api/push/test")).json() == {"sent": 1}


async def test_unsubscribe_only_removes_your_own_device(authed_client, other_client) -> None:
    await authed_client.post("/api/push/subscriptions", json=SUBSCRIPTION)
    response = await other_client.post("/api/push/unsubscribe", json={"endpoint": SUBSCRIPTION["endpoint"]})
    assert response.status_code == 204
    assert len(await stored()) == 1

    await authed_client.post("/api/push/unsubscribe", json={"endpoint": SUBSCRIPTION["endpoint"]})
    assert await stored() == []


async def test_send_test_pushes_to_every_device_and_drops_the_gone_ones(authed_client, delivered) -> None:
    for endpoint in (
        "https://fcm.googleapis.com/fcm/send/a",
        "https://fcm.googleapis.com/fcm/send/b",
        "https://fcm.googleapis.com/fcm/send/gone",
    ):
        await authed_client.post("/api/push/subscriptions", json={**SUBSCRIPTION, "endpoint": endpoint})

    response = await authed_client.post("/api/push/test")
    assert response.status_code == 201
    assert response.json() == {"sent": 2}
    assert sorted(endpoint for endpoint, _ in delivered) == [
        "https://fcm.googleapis.com/fcm/send/a",
        "https://fcm.googleapis.com/fcm/send/b",
        "https://fcm.googleapis.com/fcm/send/gone",
    ]
    assert delivered[0][1] == {"title": "acta", "body": "Notifications are working.", "url": "/settings", "tag": "test"}
    assert [row[0] for row in await stored()] == [
        "https://fcm.googleapis.com/fcm/send/a",
        "https://fcm.googleapis.com/fcm/send/b",
    ]


@pytest.mark.parametrize(
    "endpoint",
    [
        "https://fcm.googleapis.com/fcm/send/abc",
        "https://android.googleapis.com/gcm/send/abc",
        "https://updates.push.services.mozilla.com/wpush/v2/abc",
        "https://web.push.apple.com/abc",
        "https://wns2-par02p.notify.windows.com/w/?token=abc",
        "https://fcm.googleapis.com:443/fcm/send/abc",
    ],
)
def test_the_browsers_push_services_are_accepted(endpoint) -> None:
    assert is_push_service(endpoint) is True


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fcm.googleapis.com/fcm/send/abc",
        "https://fcm.googleapis.com:8443/fcm/send/abc",
        "https://evilfcm.googleapis.com.example/abc",
        "https://notfcm.googleapis.com/abc",
        "https://fcm.googleapis.com.evil.example/abc",
        "https://127.0.0.1/abc",
        "https://169.254.169.254/latest/meta-data",
        "https://localhost/api/boards",
        "https://[::1]/abc",
        "https://fcm.googleapis.com:notaport/abc",
        "not a url",
        "",
        "https:///fcm/send/abc",
        "https://:443/abc",
    ],
)
def test_anything_else_is_refused(endpoint) -> None:
    assert is_push_service(endpoint) is False


async def test_subscribing_an_address_that_is_not_a_push_service_is_refused(authed_client) -> None:
    response = await authed_client.post(
        "/api/push/subscriptions", json={**SUBSCRIPTION, "endpoint": "http://127.0.0.1:8000/api/boards"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "That isn't a browser push service's address."
    assert await stored() == []
