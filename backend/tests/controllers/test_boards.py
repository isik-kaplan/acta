import uuid

from sqlalchemy import func, select

from app.db import session_factory
from app.models import BoardColumn, Card


async def test_boards_require_a_session(client) -> None:
    assert (await client.get("/api/boards")).status_code == 401


async def test_create_board_adds_the_default_columns_and_lists_in_creation_order(authed_client) -> None:
    response = await authed_client.post("/api/boards", json={"name": "  Home  "})
    assert response.status_code == 201
    created = response.json()
    assert set(created) == {"id", "name"}
    assert created["name"] == "Home"

    boards = (await authed_client.get("/api/boards")).json()
    assert [each["name"] for each in boards] == ["My board", "Home"]

    detail = (await authed_client.get(f"/api/boards/{created['id']}")).json()
    assert detail["id"] == created["id"]
    assert detail["name"] == "Home"
    assert [column["name"] for column in detail["columns"]] == ["To do", "Doing", "Done"]


async def test_create_board_rejects_a_blank_name(authed_client) -> None:
    assert (await authed_client.post("/api/boards", json={"name": "   "})).status_code == 400


async def test_board_names_have_no_length_limit(authed_client) -> None:
    response = await authed_client.post("/api/boards", json={"name": "x" * 100_000})
    assert response.status_code == 201
    assert len(response.json()["name"]) == 100_000


async def test_list_boards_only_shows_your_own(authed_client, other_client) -> None:
    await other_client.post("/api/boards", json={"name": "Eve's"})
    assert [each["name"] for each in (await authed_client.get("/api/boards")).json()] == ["My board"]


async def test_board_detail_groups_cards_into_their_columns_in_order(authed_client, board) -> None:
    todo, doing, _ = board["columns"]
    for title, reminders in (("one", [30, 0]), ("two", [])):
        await authed_client.post(f"/api/columns/{todo['id']}/cards", json={"title": title, "reminders": reminders})
    await authed_client.post(f"/api/columns/{doing['id']}/cards", json={"title": "three"})

    detail = (await authed_client.get(f"/api/boards/{board['id']}")).json()
    assert [[card["title"] for card in column["cards"]] for column in detail["columns"]] == [
        ["one", "two"],
        ["three"],
        [],
    ]
    assert [card["position"] for card in detail["columns"][0]["cards"]] == [0, 1]
    assert [card["reminders"] for card in detail["columns"][0]["cards"]] == [[0, 30], []]
    assert set(detail["columns"][0]) == {"id", "name", "position", "cards"}


async def test_someone_elses_board_is_not_found(board, other_client) -> None:
    for response in (
        await other_client.get(f"/api/boards/{board['id']}"),
        await other_client.patch(f"/api/boards/{board['id']}", json={"name": "Mine now"}),
        await other_client.delete(f"/api/boards/{board['id']}"),
        await other_client.post(f"/api/boards/{board['id']}/columns", json={"name": "Sneaky"}),
    ):
        assert response.status_code == 404
        assert response.json()["detail"] == "No board found with this id."


async def test_an_unknown_board_is_not_found(authed_client) -> None:
    assert (await authed_client.get(f"/api/boards/{uuid.uuid4()}")).status_code == 404


async def test_rename_board(authed_client, board) -> None:
    response = await authed_client.patch(f"/api/boards/{board['id']}", json={"name": " Work "})
    assert response.status_code == 200
    assert response.json() == {"id": board["id"], "name": "Work"}
    assert (await authed_client.get("/api/boards")).json()[0]["name"] == "Work"


async def test_delete_board_takes_its_columns_and_cards_with_it(authed_client, board) -> None:
    other = (await authed_client.post("/api/boards", json={"name": "Keep"})).json()
    await authed_client.post(f"/api/columns/{board['columns'][0]['id']}/cards", json={"title": "gone"})

    response = await authed_client.delete(f"/api/boards/{board['id']}")
    assert response.status_code == 204
    assert [each["id"] for each in (await authed_client.get("/api/boards")).json()] == [other["id"]]
    async with session_factory() as db_session:
        assert await db_session.scalar(select(func.count()).select_from(Card)) == 0
        assert await db_session.scalar(select(func.count()).select_from(BoardColumn)) == 3


async def test_create_column_appends_it(authed_client, board) -> None:
    response = await authed_client.post(f"/api/boards/{board['id']}/columns", json={"name": " Later "})
    assert response.status_code == 201
    column = response.json()
    assert column["name"] == "Later"
    assert column["position"] == 3
    assert column["cards"] == []

    detail = (await authed_client.get(f"/api/boards/{board['id']}")).json()
    assert detail["columns"][-1]["id"] == column["id"]
