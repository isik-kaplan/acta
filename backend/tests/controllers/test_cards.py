import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

from app.db import session_factory
from app.models import CardReminder


async def add_cards(client, column_id: str, *titles: str) -> list[dict]:
    return [(await client.post(f"/api/columns/{column_id}/cards", json={"title": title})).json() for title in titles]


async def layout(client, board_id: str) -> list[list[tuple[str, int]]]:
    detail = (await client.get(f"/api/boards/{board_id}")).json()
    return [[(card["title"], card["position"]) for card in column["cards"]] for column in detail["columns"]]


SENT = datetime(2026, 1, 1, tzinfo=UTC)


async def mark_all_sent(card_id: str) -> None:
    async with session_factory() as db_session:
        for reminder in await db_session.scalars(
            select(CardReminder).where(CardReminder.card_id == uuid.UUID(card_id))
        ):
            reminder.sent_at = SENT
        await db_session.commit()


async def sent(card_id: str) -> dict[int, datetime | None]:
    async with session_factory() as db_session:
        rows = await db_session.scalars(select(CardReminder).where(CardReminder.card_id == uuid.UUID(card_id)))
        return {reminder.minutes_before: reminder.sent_at for reminder in rows}


def fields(title: str = "x", due_at: str | None = None, reminders: list[int] | None = None, **rest) -> dict:
    return {
        "title": title,
        "summary": "",
        "notes": "",
        "due_at": due_at,
        "reminders": reminders or [],
        "labels": [],
        **rest,
    }


async def test_update_card_replaces_every_field(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "draft")
    response = await authed_client.put(
        f"/api/cards/{card['id']}",
        json=fields(" final ", "2026-10-08T12:30:00Z", [60, 0, 60], summary="  short  ", notes=" more "),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "final"
    assert body["summary"] == "short"
    assert body["notes"] == " more "
    assert body["due_at"] == "2026-10-08T12:30:00Z"
    assert body["reminders"] == [0, 60]

    cleared = await authed_client.put(f"/api/cards/{card['id']}", json=fields("final"))
    assert cleared.json()["due_at"] is None
    assert cleared.json()["summary"] == ""
    assert cleared.json()["notes"] == ""
    assert cleared.json()["reminders"] == []
    assert await sent(card["id"]) == {}


async def test_update_card_requires_every_field(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    for missing in ("summary", "notes", "due_at", "reminders", "labels"):
        body = fields()
        del body[missing]
        assert (await authed_client.put(f"/api/cards/{card['id']}", json=body)).status_code == 400


@pytest.mark.parametrize("reminders", [[-1], [2**63]])
async def test_update_card_rejects_reminders_a_database_integer_cannot_hold(authed_client, board, reminders) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    response = await authed_client.put(f"/api/cards/{card['id']}", json=fields(reminders=reminders))
    assert response.status_code == 400


async def test_update_card_takes_any_number_of_reminders_any_distance_ahead(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    reminders = [2**63 - 1, *range(500)]
    response = await authed_client.put(f"/api/cards/{card['id']}", json=fields(reminders=reminders))
    assert response.json()["reminders"] == sorted(reminders)


async def test_update_card_takes_long_text(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    response = await authed_client.put(
        f"/api/cards/{card['id']}", json=fields(summary="s" * 100_000, notes="n" * 1_000_000)
    )
    assert response.status_code == 200
    assert len(response.json()["notes"]) == 1_000_000


async def test_a_kept_reminder_stays_sent_while_the_due_date_stays(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    url = f"/api/cards/{card['id']}"
    await authed_client.put(url, json=fields(due_at="2026-10-08T12:00:00Z", reminders=[0, 30]))
    await mark_all_sent(card["id"])

    # Same moment, another zone: not a change. The kept one stays sent, the new one is armed.
    await authed_client.put(url, json=fields("renamed", "2026-10-08T14:00:00+02:00", [30, 60]))
    assert await sent(card["id"]) == {30: SENT, 60: None}


async def test_changing_the_due_date_rearms_every_reminder(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    url = f"/api/cards/{card['id']}"
    await authed_client.put(url, json=fields(due_at="2026-10-08T12:00:00Z", reminders=[0, 30]))
    await mark_all_sent(card["id"])
    await authed_client.put(url, json=fields(due_at="2026-10-09T12:00:00Z", reminders=[0, 30]))
    assert await sent(card["id"]) == {0: None, 30: None}


async def test_clearing_the_due_date_rearms_the_reminders(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    url = f"/api/cards/{card['id']}"
    await authed_client.put(url, json=fields(due_at="2026-10-08T12:00:00Z", reminders=[0]))
    await mark_all_sent(card["id"])
    await authed_client.put(url, json=fields(reminders=[0]))
    assert await sent(card["id"]) == {0: None}


async def test_move_card_to_another_column_closes_the_gap_it_leaves(authed_client, board) -> None:
    todo, doing, _ = board["columns"]
    cards = {card["title"]: card for card in await add_cards(authed_client, todo["id"], "a", "b", "c")}
    await add_cards(authed_client, doing["id"], "x", "y")

    response = await authed_client.post(
        f"/api/cards/{cards['a']['id']}/move", json={"column_id": doing["id"], "index": 1}
    )
    assert response.status_code == 201
    assert response.json()["column_id"] == doing["id"]
    assert response.json()["position"] == 1
    assert await layout(authed_client, board["id"]) == [
        [("b", 0), ("c", 1)],
        [("x", 0), ("a", 1), ("y", 2)],
        [],
    ]


async def test_move_card_answers_with_its_reminders(authed_client, board) -> None:
    todo, doing, _ = board["columns"]
    (card,) = await add_cards(authed_client, todo["id"], "a")
    await authed_client.put(f"/api/cards/{card['id']}", json=fields("a", "2026-10-08T12:00:00Z", [15]))
    response = await authed_client.post(f"/api/cards/{card['id']}/move", json={"column_id": doing["id"], "index": 0})
    assert response.json()["reminders"] == [15]


async def test_move_card_into_an_empty_column(authed_client, board) -> None:
    todo, _, done = board["columns"]
    (card,) = await add_cards(authed_client, todo["id"], "a")
    await authed_client.post(f"/api/cards/{card['id']}/move", json={"column_id": done["id"], "index": 7})
    assert await layout(authed_client, board["id"]) == [[], [], [("a", 0)]]


async def test_move_card_onto_someone_elses_column_is_not_found(authed_client, board, other_client) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "a")
    theirs = (await other_client.get("/api/boards")).json()[0]
    their_column = (await other_client.get(f"/api/boards/{theirs['id']}")).json()["columns"][0]
    response = await authed_client.post(
        f"/api/cards/{card['id']}/move", json={"column_id": their_column["id"], "index": 0}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "No column found with this id."
    assert await layout(authed_client, board["id"]) == [[("a", 0)], [], []]


async def test_delete_card_renumbers_its_column(authed_client, board) -> None:
    column_id = board["columns"][0]["id"]
    cards = await add_cards(authed_client, column_id, "a", "b", "c")
    response = await authed_client.delete(f"/api/cards/{cards[0]['id']}")
    assert response.status_code == 204
    assert (await layout(authed_client, board["id"]))[0] == [("b", 0), ("c", 1)]


async def test_delete_card_takes_its_reminders_with_it(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "a")
    await authed_client.put(f"/api/cards/{card['id']}", json=fields("a", "2026-10-08T12:00:00Z", [0, 15]))
    await authed_client.delete(f"/api/cards/{card['id']}")
    assert await sent(card["id"]) == {}


async def test_delete_card_renumbers_by_position_not_by_age(authed_client, board) -> None:
    column_id = board["columns"][0]["id"]
    a, _, c = await add_cards(authed_client, column_id, "a", "b", "c")
    await authed_client.post(f"/api/cards/{c['id']}/move", json={"column_id": column_id, "index": 0})
    await authed_client.delete(f"/api/cards/{a['id']}")
    assert (await layout(authed_client, board["id"]))[0] == [("c", 0), ("b", 1)]


async def test_someone_elses_card_is_not_found(authed_client, board, other_client) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "a")
    for response in (
        await other_client.put(f"/api/cards/{card['id']}", json=fields()),
        await other_client.post(
            f"/api/cards/{card['id']}/move", json={"column_id": board["columns"][1]["id"], "index": 0}
        ),
        await other_client.delete(f"/api/cards/{card['id']}"),
    ):
        assert response.status_code == 404
        assert response.json()["detail"] == "No card found with this id."


async def test_an_unknown_card_is_not_found(authed_client) -> None:
    assert (await authed_client.delete(f"/api/cards/{uuid.uuid4()}")).status_code == 404
