import uuid
from datetime import UTC, datetime

import pytest

from app.db import session_factory
from app.models import Label
from app.schemas import LABEL_COLORS
from app.services.labels import next_color


async def add_label(client, board_id: str, name: str, color: str | None = None):
    body = {"name": name} if color is None else {"name": name, "color": color}
    return await client.post(f"/api/boards/{board_id}/labels", json=body)


async def detail(client, board_id: str) -> dict:
    return (await client.get(f"/api/boards/{board_id}")).json()


def card_fields(labels: list[str], title: str = "x") -> dict:
    return {"title": title, "summary": "", "notes": "", "due_at": None, "reminders": [], "labels": labels}


async def test_create_label_takes_a_trimmed_name_and_a_picked_color(authed_client, board) -> None:
    response = await add_label(authed_client, board["id"], "  Urgent  ", "red")
    assert response.status_code == 201
    label = response.json()
    assert set(label) == {"id", "name", "color"}
    assert label["name"] == "Urgent"
    assert label["color"] == "red"
    assert (await detail(authed_client, board["id"]))["labels"] == [label]


async def test_a_new_board_has_no_labels(authed_client, board) -> None:
    assert board["labels"] == []


async def test_labels_without_a_color_walk_the_palette(authed_client, board) -> None:
    colors = [(await add_label(authed_client, board["id"], f"l{index}")).json()["color"] for index in range(4)]
    assert colors == list(LABEL_COLORS[:4])


async def test_an_auto_color_skips_one_picked_by_hand(authed_client, board) -> None:
    await add_label(authed_client, board["id"], "picked", LABEL_COLORS[0])
    assert (await add_label(authed_client, board["id"], "auto")).json()["color"] == LABEL_COLORS[1]


def test_next_color_takes_the_least_used_then_the_earliest() -> None:
    class Stub:
        def __init__(self, color: str) -> None:
            self.color = color

    assert next_color([]) == LABEL_COLORS[0]
    every_once = [Stub(color) for color in LABEL_COLORS]
    assert next_color(every_once) == LABEL_COLORS[0]
    assert next_color([*every_once, Stub(LABEL_COLORS[0])]) == LABEL_COLORS[1]
    assert next_color([Stub(LABEL_COLORS[2]), Stub(LABEL_COLORS[0])]) == LABEL_COLORS[1]


async def test_labels_are_listed_oldest_first(authed_client, board) -> None:
    for name in ("b", "a", "c"):
        await add_label(authed_client, board["id"], name)
    assert [label["name"] for label in (await detail(authed_client, board["id"]))["labels"]] == ["b", "a", "c"]


@pytest.mark.parametrize("body", [{"name": "  "}, {"name": "x", "color": "chartreuse"}, {}])
async def test_create_label_rejects_a_blank_name_or_an_unknown_color(authed_client, board, body) -> None:
    assert (await authed_client.post(f"/api/boards/{board['id']}/labels", json=body)).status_code == 400


async def test_label_names_are_unique_per_board_ignoring_case(authed_client, board) -> None:
    await add_label(authed_client, board["id"], "Urgent")
    clash = await add_label(authed_client, board["id"], " urgent ")
    assert clash.status_code == 409
    assert clash.json()["detail"] == 'There is already a label called "urgent" on this board.'
    other = (await authed_client.post("/api/boards", json={"name": "Other"})).json()
    assert (await add_label(authed_client, other["id"], "Urgent")).status_code == 201


async def test_update_label_renames_and_recolors(authed_client, board) -> None:
    label = (await add_label(authed_client, board["id"], "Urgent")).json()
    response = await authed_client.put(f"/api/labels/{label['id']}", json={"name": " Soon ", "color": "teal"})
    assert response.status_code == 200
    assert response.json() == {"id": label["id"], "name": "Soon", "color": "teal"}
    assert (await detail(authed_client, board["id"]))["labels"] == [response.json()]


async def test_update_label_may_keep_its_own_name_but_not_take_another(authed_client, board) -> None:
    first = (await add_label(authed_client, board["id"], "Urgent")).json()
    await add_label(authed_client, board["id"], "Later")
    url = f"/api/labels/{first['id']}"
    assert (await authed_client.put(url, json={"name": "URGENT", "color": "red"})).status_code == 200
    assert (await authed_client.put(url, json={"name": "later", "color": "red"})).status_code == 409


async def test_update_label_needs_both_fields(authed_client, board) -> None:
    label = (await add_label(authed_client, board["id"], "Urgent")).json()
    url = f"/api/labels/{label['id']}"
    assert (await authed_client.put(url, json={"name": "x"})).status_code == 400
    assert (await authed_client.put(url, json={"color": "red"})).status_code == 400


async def test_cards_carry_labels_in_the_boards_order(authed_client, board) -> None:
    a, b = [(await add_label(authed_client, board["id"], name)).json()["id"] for name in ("a", "b")]
    column_id = board["columns"][0]["id"]
    created = await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": "x", "labels": [b, a, b]})
    assert created.status_code == 201
    assert created.json()["labels"] == [a, b]
    assert (await detail(authed_client, board["id"]))["columns"][0]["cards"][0]["labels"] == [a, b]

    updated = await authed_client.put(f"/api/cards/{created.json()['id']}", json=card_fields([b]))
    assert updated.json()["labels"] == [b]
    cleared = await authed_client.put(f"/api/cards/{created.json()['id']}", json=card_fields([]))
    assert cleared.json()["labels"] == []


async def test_deleting_a_label_takes_it_off_its_cards(authed_client, board) -> None:
    a, b = [(await add_label(authed_client, board["id"], name)).json()["id"] for name in ("a", "b")]
    column_id = board["columns"][0]["id"]
    await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": "x", "labels": [a, b]})
    assert (await authed_client.delete(f"/api/labels/{a}")).status_code == 204
    after = await detail(authed_client, board["id"])
    assert [label["id"] for label in after["labels"]] == [b]
    assert after["columns"][0]["cards"][0]["labels"] == [b]


async def test_deleting_a_board_takes_its_labels(authed_client, board) -> None:
    label = (await add_label(authed_client, board["id"], "a")).json()
    await authed_client.delete(f"/api/boards/{board['id']}")
    assert (await authed_client.delete(f"/api/labels/{label['id']}")).status_code == 404


async def test_a_card_cannot_take_a_label_from_another_board(authed_client, board) -> None:
    other = (await authed_client.post("/api/boards", json={"name": "Other"})).json()
    foreign = (await add_label(authed_client, other["id"], "elsewhere")).json()["id"]
    column_id = board["columns"][0]["id"]
    response = await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": "x", "labels": [foreign]})
    assert response.status_code == 404
    assert response.json()["detail"] == "No label found with this id."
    assert (await detail(authed_client, board["id"]))["columns"][0]["cards"] == []

    card = (await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": "x"})).json()
    response = await authed_client.put(f"/api/cards/{card['id']}", json=card_fields([foreign, str(uuid.uuid4())]))
    assert response.status_code == 404


async def test_moving_a_card_within_its_board_keeps_its_labels(authed_client, board) -> None:
    label = (await add_label(authed_client, board["id"], "a")).json()["id"]
    todo, doing, _ = board["columns"]
    card = (await authed_client.post(f"/api/columns/{todo['id']}/cards", json={"title": "x", "labels": [label]})).json()
    moved = await authed_client.post(f"/api/cards/{card['id']}/move", json={"column_id": doing["id"], "index": 0})
    assert moved.json()["labels"] == [label]


async def test_moving_a_card_to_another_board_leaves_its_labels_behind(authed_client, board) -> None:
    label = (await add_label(authed_client, board["id"], "a")).json()["id"]
    card = (
        await authed_client.post(
            f"/api/columns/{board['columns'][0]['id']}/cards", json={"title": "x", "labels": [label]}
        )
    ).json()
    other = (await authed_client.post("/api/boards", json={"name": "Other"})).json()
    target = (await detail(authed_client, other["id"]))["columns"][0]["id"]
    moved = await authed_client.post(f"/api/cards/{card['id']}/move", json={"column_id": target, "index": 0})
    assert moved.json()["labels"] == []
    assert [label["name"] for label in (await detail(authed_client, board["id"]))["labels"]] == ["a"]


async def test_someone_elses_labels_are_not_found(authed_client, board, other_client) -> None:
    label = (await add_label(authed_client, board["id"], "mine")).json()
    for response in (
        await other_client.put(f"/api/labels/{label['id']}", json={"name": "theirs", "color": "red"}),
        await other_client.delete(f"/api/labels/{label['id']}"),
        await add_label(other_client, board["id"], "sneaky"),
    ):
        assert response.status_code == 404
    theirs = (await other_client.get("/api/boards")).json()[0]
    their_column = (await detail(other_client, theirs["id"]))["columns"][0]["id"]
    response = await other_client.post(
        f"/api/columns/{their_column}/cards", json={"title": "x", "labels": [label["id"]]}
    )
    assert response.status_code == 404
    assert (await detail(authed_client, board["id"]))["labels"] == [label]


async def test_an_unknown_label_is_not_found(authed_client) -> None:
    response = await authed_client.delete(f"/api/labels/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["detail"] == "No label found with this id."


async def test_update_and_delete_act_on_the_label_asked_for(authed_client, board) -> None:
    first, second = [(await add_label(authed_client, board["id"], name)).json() for name in ("a", "b")]
    await authed_client.put(f"/api/labels/{second['id']}", json={"name": "b2", "color": "red"})
    await authed_client.delete(f"/api/labels/{first['id']}")
    assert (await detail(authed_client, board["id"]))["labels"] == [{"id": second["id"], "name": "b2", "color": "red"}]


async def test_labels_order_by_creation_time_then_id(authed_client, board) -> None:
    # Made out of id order on purpose: the newest has the smallest id, and two share a moment.
    board_id = uuid.UUID(board["id"])
    early, late = datetime(2026, 1, 1, tzinfo=UTC), datetime(2026, 2, 1, tzinfo=UTC)
    rows = [
        (uuid.UUID(int=1), "newest", late),
        (uuid.UUID(int=3), "tied-high", early),
        (uuid.UUID(int=2), "tied-low", early),
    ]
    async with session_factory() as db_session:
        for label_id, name, created_at in rows:
            db_session.add(Label(id=label_id, board_id=board_id, name=name, color="blue", created_at=created_at))
            await db_session.flush()
        await db_session.commit()
    column_id = board["columns"][0]["id"]
    card = await authed_client.post(
        f"/api/columns/{column_id}/cards", json={"title": "x", "labels": [str(label_id) for label_id, _, _ in rows]}
    )
    expected = ["tied-low", "tied-high", "newest"]
    names = {str(label_id): name for label_id, name, _ in rows}
    assert [names[label_id] for label_id in card.json()["labels"]] == expected
    assert [label["name"] for label in (await detail(authed_client, board["id"]))["labels"]] == expected
