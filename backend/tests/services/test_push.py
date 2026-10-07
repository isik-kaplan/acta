import json
from types import SimpleNamespace

import pytest
from pywebpush import WebPushException

from app.models import PushSubscription
from app.services import push
from app.services.vapid import VapidKeys


SUBSCRIPTION = PushSubscription(endpoint="https://fcm.googleapis.com/fcm/send/x", p256dh="p", auth="a")


@pytest.fixture(autouse=True)
def keys(monkeypatch) -> None:
    monkeypatch.setattr(push, "vapid_keys", lambda: VapidKeys(private_key="private", public_key="public"))


def test_deliver_sends_the_payload_signed_with_the_vapid_key(monkeypatch) -> None:
    calls = []
    monkeypatch.setattr(push, "webpush", lambda **kwargs: calls.append(kwargs))
    monkeypatch.setattr(push.settings, "VAPID_SUBJECT", "mailto:me@example.com")

    assert push.deliver(SUBSCRIPTION, {"title": "Hi"}) is True
    assert calls == [
        {
            "subscription_info": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/x",
                "keys": {"p256dh": "p", "auth": "a"},
            },
            "data": json.dumps({"title": "Hi"}),
            "vapid_private_key": "private",
            "vapid_claims": {"sub": "mailto:me@example.com"},
            "ttl": 86400,
        }
    ]


@pytest.mark.parametrize(("status", "kept"), [(404, False), (410, False), (500, True), (429, True), (None, True)])
def test_deliver_reports_only_a_gone_subscription(monkeypatch, caplog, status, kept) -> None:
    response = None if status is None else SimpleNamespace(status_code=status)

    def fail(**kwargs):
        raise WebPushException("nope", response=response)

    monkeypatch.setattr(push, "webpush", fail)
    assert push.deliver(SUBSCRIPTION, {}) is kept
    error = WebPushException("nope", response=response)
    messages = [record.getMessage() for record in caplog.records]
    assert messages == ([f"Push to https://fcm.googleapis.com/fcm/send/x failed: {error}"] if kept else [])
