import asyncio
import uuid
from datetime import UTC, datetime

import pytest

from app.db import session_factory
from app.models import Card
from app.services import push, reminders


NOW = datetime(2026, 10, 6, 12, 0, tzinfo=UTC)


@pytest.fixture
def delivered(monkeypatch) -> list[tuple[str, dict]]:
    sent = []

    def fake_deliver(subscription, payload) -> bool:
        sent.append((subscription.endpoint, payload))
        return True

    monkeypatch.setattr(push, "deliver", fake_deliver)
    return sent


async def add_card(client, column_id: str, title: str, due_at: str | None) -> dict:
    response = await client.post(f"/api/columns/{column_id}/cards", json={"title": title, "due_at": due_at})
    return response.json()


async def reminded_at(card_id: str) -> datetime | None:
    async with session_factory() as db_session:
        return (await db_session.get(Card, uuid.UUID(card_id))).reminded_at


async def subscribe(client, endpoint: str) -> None:
    await client.post("/api/push/subscriptions", json={"endpoint": endpoint, "keys": {"p256dh": "p", "auth": "a"}})


async def test_due_cards_are_pushed_once_to_their_owner(authed_client, board, other_client, delivered) -> None:
    await subscribe(authed_client, "https://push.example/ada")
    await subscribe(other_client, "https://push.example/eve")
    column_id = board["columns"][0]["id"]
    later = await add_card(authed_client, column_id, "later", "2026-10-06T12:00:01Z")
    exactly = await add_card(authed_client, column_id, "exactly now", "2026-10-06T14:00:00+02:00")
    earlier = await add_card(authed_client, column_id, "earlier", "2026-10-06T11:00:00Z")
    await add_card(authed_client, column_id, "undated", None)

    assert await reminders.send_due_reminders(NOW) == 2
    assert sorted(payload["title"] for _, payload in delivered) == ["earlier", "exactly now"]
    assert {endpoint for endpoint, _ in delivered} == {"https://push.example/ada"}
    assert next(payload for _, payload in delivered if payload["title"] == "earlier") == {
        "title": "earlier",
        "body": "Due now · My board",
        "url": f"/boards/{board['id']}?card={earlier['id']}",
        "tag": f"card-{earlier['id']}",
    }
    assert await reminded_at(earlier["id"]) == NOW
    assert await reminded_at(exactly["id"]) == NOW
    assert await reminded_at(later["id"]) is None

    assert await reminders.send_due_reminders(NOW) == 0
    assert len(delivered) == 2


async def test_a_due_card_is_marked_reminded_even_with_no_device_to_push_to(authed_client, board, delivered) -> None:
    card = await add_card(authed_client, board["columns"][0]["id"], "x", "2026-10-06T11:00:00Z")
    assert await reminders.send_due_reminders(NOW) == 1
    assert delivered == []
    assert await reminded_at(card["id"]) == NOW


async def test_send_due_reminders_defaults_to_the_current_time(authed_client, board, delivered, monkeypatch) -> None:
    monkeypatch.setattr(reminders, "utcnow", lambda: NOW)
    card = await add_card(authed_client, board["columns"][0]["id"], "x", "2026-10-06T11:00:00Z")
    assert await reminders.send_due_reminders() == 1
    assert await reminded_at(card["id"]) == NOW


async def test_run_reminders_keeps_going_after_a_failed_pass(monkeypatch, caplog) -> None:
    passes = []
    sleeps = []

    async def flaky_pass():
        passes.append(len(passes))
        if len(passes) == 1:
            raise RuntimeError("database is locked")
        return 0

    async def fake_sleep(seconds):
        sleeps.append(seconds)
        if len(sleeps) == 2:
            raise asyncio.CancelledError

    monkeypatch.setattr(reminders, "send_due_reminders", flaky_pass)
    monkeypatch.setattr(reminders.asyncio, "sleep", fake_sleep)
    with pytest.raises(asyncio.CancelledError):
        await reminders.run_reminders(30)
    assert passes == [0, 1]
    assert sleeps == [30, 30]
    assert [record.getMessage() for record in caplog.records] == ["Reminder pass failed"]
