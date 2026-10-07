import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.db import session_factory
from app.models import CardReminder
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


async def add_card(client, column_id: str, title: str, due_at: str | None, reminders: tuple[int, ...] = (0,)) -> dict:
    response = await client.post(
        f"/api/columns/{column_id}/cards", json={"title": title, "due_at": due_at, "reminders": list(reminders)}
    )
    return response.json()


async def sent(card_id: str) -> dict[int, datetime | None]:
    async with session_factory() as db_session:
        rows = await db_session.scalars(select(CardReminder).where(CardReminder.card_id == uuid.UUID(card_id)))
        return {reminder.minutes_before: reminder.sent_at for reminder in rows}


async def subscribe(client, endpoint: str) -> None:
    await client.post("/api/push/subscriptions", json={"endpoint": endpoint, "keys": {"p256dh": "p", "auth": "a"}})


@pytest.mark.parametrize(
    ("minutes", "text"),
    [
        (0, "Due now"),
        (1, "Due in 1 minute"),
        (45, "Due in 45 minutes"),
        (60, "Due in 1 hour"),
        (90, "Due in 90 minutes"),
        (120, "Due in 2 hours"),
        (1_440, "Due in 1 day"),
        (2_880, "Due in 2 days"),
        (10_080, "Due in 1 week"),
        (11_520, "Due in 8 days"),
        (40_320, "Due in 4 weeks"),
        (525_600, "Due in 365 days"),
    ],
)
def test_lead_time_reads_in_the_largest_whole_unit(minutes, text) -> None:
    assert reminders.lead_time(minutes) == text


async def test_due_reminders_are_pushed_once_to_their_owner(authed_client, board, other_client, delivered) -> None:
    await subscribe(authed_client, "https://fcm.googleapis.com/fcm/send/ada")
    await subscribe(other_client, "https://fcm.googleapis.com/fcm/send/eve")
    column_id = board["columns"][0]["id"]
    later = await add_card(authed_client, column_id, "later", "2026-10-06T12:00:01Z")
    exactly = await add_card(authed_client, column_id, "exactly now", "2026-10-06T14:00:00+02:00")
    earlier = await add_card(authed_client, column_id, "earlier", "2026-10-06T11:00:00Z")
    await add_card(authed_client, column_id, "undated", None)
    await add_card(authed_client, column_id, "no reminders", "2026-10-06T11:00:00Z", ())

    assert await reminders.send_due_reminders(NOW) == 2
    assert sorted(payload["title"] for _, payload in delivered) == ["earlier", "exactly now"]
    assert {endpoint for endpoint, _ in delivered} == {"https://fcm.googleapis.com/fcm/send/ada"}
    assert next(payload for _, payload in delivered if payload["title"] == "earlier") == {
        "title": "earlier",
        "body": "Due now · My board",
        "url": f"/boards/{board['id']}?card={earlier['id']}",
        "tag": f"card-{earlier['id']}",
    }
    assert await sent(earlier["id"]) == {0: NOW}
    assert await sent(exactly["id"]) == {0: NOW}
    assert await sent(later["id"]) == {0: None}

    assert await reminders.send_due_reminders(NOW) == 0
    assert len(delivered) == 2


async def test_a_reminder_goes_out_its_lead_time_before_the_due_time(authed_client, board, delivered) -> None:
    await subscribe(authed_client, "https://fcm.googleapis.com/fcm/send/ada")
    column_id = board["columns"][0]["id"]
    card = await add_card(authed_client, column_id, "x", "2026-10-06T12:30:00Z", (0, 29, 30))
    assert await reminders.send_due_reminders(NOW) == 1
    assert [payload["body"] for _, payload in delivered] == ["Due in 30 minutes · My board"]
    assert await sent(card["id"]) == {0: None, 29: None, 30: NOW}


async def test_a_reminder_can_be_set_any_distance_ahead(authed_client, board, delivered) -> None:
    column_id = board["columns"][0]["id"]
    # A year ahead, to the microsecond: one lands exactly now, one a microsecond later.
    edge = await add_card(authed_client, column_id, "edge", "2027-10-06T12:00:00Z", (525_600,))
    beyond = await add_card(authed_client, column_id, "beyond", "2027-10-06T12:00:00.000001Z", (525_600,))
    # Further back than any date goes: long since due.
    endless = await add_card(authed_client, column_id, "endless", "9999-12-31T23:59:00Z", (2**63 - 1,))
    assert await reminders.send_due_reminders(NOW) == 2
    assert await sent(edge["id"]) == {525_600: NOW}
    assert await sent(beyond["id"]) == {525_600: None}
    assert await sent(endless["id"]) == {2**63 - 1: NOW}


@pytest.mark.parametrize(
    ("due_at", "minutes_before", "expected"),
    [
        (datetime(2026, 10, 6, 12, 1, tzinfo=UTC), 1, True),
        (datetime(2026, 10, 6, 12, 1, 0, 1, tzinfo=UTC), 1, False),
        (datetime(2026, 10, 6, 11, 0, tzinfo=UTC), 0, True),
        (datetime(2026, 10, 6, 12, 0, 0, 1, tzinfo=UTC), 0, False),
        # Millennia out, where a float can no longer tell one microsecond from the next.
        (NOW + timedelta(minutes=4_000_000_000, microseconds=1), 4_000_000_000, False),
        (NOW + timedelta(minutes=4_000_000_000), 4_000_000_000, True),
    ],
)
def test_is_due_to_the_microsecond(due_at, minutes_before, expected) -> None:
    assert reminders.is_due(due_at, minutes_before, NOW) is expected


async def test_several_due_at_once_go_out_most_urgent_last(authed_client, board, delivered) -> None:
    await subscribe(authed_client, "https://fcm.googleapis.com/fcm/send/ada")
    await add_card(authed_client, board["columns"][0]["id"], "x", "2026-10-06T11:00:00Z", (60, 0, 1440))
    assert await reminders.send_due_reminders(NOW) == 3
    assert [payload["body"] for _, payload in delivered] == [
        "Due in 1 day · My board",
        "Due in 1 hour · My board",
        "Due now · My board",
    ]


async def test_a_due_reminder_is_marked_sent_even_with_no_device_to_push_to(authed_client, board, delivered) -> None:
    card = await add_card(authed_client, board["columns"][0]["id"], "x", "2026-10-06T11:00:00Z")
    assert await reminders.send_due_reminders(NOW) == 1
    assert delivered == []
    assert await sent(card["id"]) == {0: NOW}


async def test_send_due_reminders_defaults_to_the_current_time(authed_client, board, delivered, monkeypatch) -> None:
    monkeypatch.setattr(reminders, "utcnow", lambda: NOW)
    card = await add_card(authed_client, board["columns"][0]["id"], "x", "2026-10-06T11:00:00Z")
    assert await reminders.send_due_reminders() == 1
    assert await sent(card["id"]) == {0: NOW}


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
