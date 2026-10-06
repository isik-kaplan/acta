import uuid
from datetime import UTC, datetime

import pytest

from app.db import session_factory
from app.models import Card


async def add_cards(client, column_id: str, *titles: str) -> list[dict]:
    return [(await client.post(f"/api/columns/{column_id}/cards", json={"title": title})).json() for title in titles]


async def layout(client, board_id: str) -> list[list[tuple[str, int]]]:
    detail = (await client.get(f"/api/boards/{board_id}")).json()
    return [[(card["title"], card["position"]) for card in column["cards"]] for column in detail["columns"]]


async def set_reminded(card_id: str) -> None:
    async with session_factory() as db_session:
        card = await db_session.get(Card, uuid.UUID(card_id))
        card.reminded_at = datetime(2026, 1, 1, tzinfo=UTC)
        await db_session.commit()


async def reminded_at(card_id: str) -> datetime | None:
    async with session_factory() as db_session:
        return (await db_session.get(Card, uuid.UUID(card_id))).reminded_at


async def test_update_card_replaces_every_field(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "draft")
    response = await authed_client.put(
        f"/api/cards/{card['id']}",
        json={"title": " final ", "notes": "more", "due_at": "2026-10-08T12:30:00Z"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "final"
    assert body["notes"] == "more"
    assert body["due_at"] == "2026-10-08T12:30:00Z"

    cleared = await authed_client.put(f"/api/cards/{card['id']}", json={"title": "final", "notes": "", "due_at": None})
    assert cleared.json()["due_at"] is None
    assert cleared.json()["notes"] == ""


async def test_changing_the_due_date_rearms_the_reminder(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    url = f"/api/cards/{card['id']}"
    await authed_client.put(url, json={"title": "x", "notes": "", "due_at": "2026-10-08T12:00:00Z"})
    await set_reminded(card["id"])

    # Same moment, another zone: not a change, so the sent reminder stays sent.
    await authed_client.put(url, json={"title": "renamed", "notes": "", "due_at": "2026-10-08T14:00:00+02:00"})
    assert await reminded_at(card["id"]) is not None

    await authed_client.put(url, json={"title": "renamed", "notes": "", "due_at": "2026-10-09T12:00:00Z"})
    assert await reminded_at(card["id"]) is None


async def test_clearing_the_due_date_rearms_the_reminder(authed_client, board) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "x")
    url = f"/api/cards/{card['id']}"
    await authed_client.put(url, json={"title": "x", "notes": "", "due_at": "2026-10-08T12:00:00Z"})
    await set_reminded(card["id"])
    await authed_client.put(url, json={"title": "x", "notes": "", "due_at": None})
    assert await reminded_at(card["id"]) is None


@pytest.mark.parametrize(
    ("moved", "index", "expected"),
    [
        ("a", 2, [("b", 0), ("c", 1), ("a", 2)]),
        ("c", 0, [("c", 0), ("a", 1), ("b", 2)]),
        ("a", 1, [("b", 0), ("a", 1), ("c", 2)]),
        ("b", 1, [("a", 0), ("b", 1), ("c", 2)]),
        ("a", 50, [("b", 0), ("c", 1), ("a", 2)]),
    ],
)
async def test_move_card_within_its_column(authed_client, board, moved, index, expected) -> None:
    column_id = board["columns"][0]["id"]
    cards = {card["title"]: card for card in await add_cards(authed_client, column_id, "a", "b", "c")}
    response = await authed_client.post(
        f"/api/cards/{cards[moved]['id']}/move", json={"column_id": column_id, "index": index}
    )
    assert response.status_code == 201
    assert response.json()["position"] == dict(expected)[moved]
    assert (await layout(authed_client, board["id"]))[0] == expected


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


async def test_delete_card_renumbers_by_position_not_by_age(authed_client, board) -> None:
    column_id = board["columns"][0]["id"]
    a, _, c = await add_cards(authed_client, column_id, "a", "b", "c")
    await authed_client.post(f"/api/cards/{c['id']}/move", json={"column_id": column_id, "index": 0})
    await authed_client.delete(f"/api/cards/{a['id']}")
    assert (await layout(authed_client, board["id"]))[0] == [("c", 0), ("b", 1)]


async def test_someone_elses_card_is_not_found(authed_client, board, other_client) -> None:
    (card,) = await add_cards(authed_client, board["columns"][0]["id"], "a")
    for response in (
        await other_client.put(f"/api/cards/{card['id']}", json={"title": "x", "notes": "", "due_at": None}),
        await other_client.post(
            f"/api/cards/{card['id']}/move", json={"column_id": board["columns"][1]["id"], "index": 0}
        ),
        await other_client.delete(f"/api/cards/{card['id']}"),
    ):
        assert response.status_code == 404
        assert response.json()["detail"] == "No card found with this id."


async def test_an_unknown_card_is_not_found(authed_client) -> None:
    assert (await authed_client.delete(f"/api/cards/{uuid.uuid4()}")).status_code == 404
