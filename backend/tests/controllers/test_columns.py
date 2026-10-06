import uuid

import pytest


def names(detail: dict) -> list[str]:
    return [column["name"] for column in detail["columns"]]


async def test_rename_column_returns_the_whole_board(authed_client, board) -> None:
    doing = board["columns"][1]
    response = await authed_client.patch(f"/api/columns/{doing['id']}", json={"name": " In progress "})
    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == board["id"]
    assert names(detail) == ["To do", "In progress", "Done"]


async def test_rename_column_rejects_a_blank_name(authed_client, board) -> None:
    response = await authed_client.patch(f"/api/columns/{board['columns'][0]['id']}", json={"name": " "})
    assert response.status_code == 400


@pytest.mark.parametrize(
    ("source", "index", "expected"),
    [
        (0, 2, ["Doing", "Done", "To do"]),
        (2, 0, ["Done", "To do", "Doing"]),
        (0, 1, ["Doing", "To do", "Done"]),
        (1, 1, ["To do", "Doing", "Done"]),
        # Past the end is clamped to the end rather than refused.
        (0, 99, ["Doing", "Done", "To do"]),
    ],
)
async def test_move_column(authed_client, board, source, index, expected) -> None:
    column = board["columns"][source]
    response = await authed_client.post(f"/api/columns/{column['id']}/move", json={"index": index})
    assert response.status_code == 201
    detail = response.json()
    assert names(detail) == expected
    assert [column["position"] for column in detail["columns"]] == [0, 1, 2]
    assert names((await authed_client.get(f"/api/boards/{board['id']}")).json()) == expected


async def test_move_column_rejects_a_negative_index(authed_client, board) -> None:
    response = await authed_client.post(f"/api/columns/{board['columns'][0]['id']}/move", json={"index": -1})
    assert response.status_code == 400


async def test_delete_column_renumbers_the_rest_and_drops_its_cards(authed_client, board) -> None:
    todo, doing, _ = board["columns"]
    await authed_client.post(f"/api/columns/{todo['id']}/cards", json={"title": "goes"})
    await authed_client.post(f"/api/columns/{doing['id']}/cards", json={"title": "stays"})

    response = await authed_client.delete(f"/api/columns/{todo['id']}")
    assert response.status_code == 204
    detail = (await authed_client.get(f"/api/boards/{board['id']}")).json()
    assert names(detail) == ["Doing", "Done"]
    assert [column["position"] for column in detail["columns"]] == [0, 1]
    assert [card["title"] for card in detail["columns"][0]["cards"]] == ["stays"]


async def test_someone_elses_column_is_not_found(board, other_client) -> None:
    column_id = board["columns"][0]["id"]
    for response in (
        await other_client.patch(f"/api/columns/{column_id}", json={"name": "x"}),
        await other_client.post(f"/api/columns/{column_id}/move", json={"index": 0}),
        await other_client.delete(f"/api/columns/{column_id}"),
        await other_client.post(f"/api/columns/{column_id}/cards", json={"title": "x"}),
    ):
        assert response.status_code == 404
        assert response.json()["detail"] == "No column found with this id."


async def test_an_unknown_column_is_not_found(authed_client) -> None:
    assert (await authed_client.delete(f"/api/columns/{uuid.uuid4()}")).status_code == 404


async def test_create_card_appends_it_with_its_fields(authed_client, board) -> None:
    column_id = board["columns"][0]["id"]
    first = (await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": "first"})).json()
    assert first["position"] == 0
    assert first["notes"] == ""
    assert first["due_at"] is None
    assert first["column_id"] == column_id

    response = await authed_client.post(
        f"/api/columns/{column_id}/cards",
        json={"title": "  second  ", "notes": "details", "due_at": "2026-10-07T09:00:00+02:00"},
    )
    assert response.status_code == 201
    second = response.json()
    assert set(second) == {"id", "column_id", "title", "notes", "due_at", "position"}
    assert second["title"] == "second"
    assert second["notes"] == "details"
    assert second["due_at"] == "2026-10-07T07:00:00Z"
    assert second["position"] == 1


async def test_create_card_rejects_a_due_date_without_a_zone(authed_client, board) -> None:
    response = await authed_client.post(
        f"/api/columns/{board['columns'][0]['id']}/cards", json={"title": "x", "due_at": "2026-10-07T09:00:00"}
    )
    assert response.status_code == 400


async def test_create_card_rejects_a_blank_or_overlong_title(authed_client, board) -> None:
    url = f"/api/columns/{board['columns'][0]['id']}/cards"
    assert (await authed_client.post(url, json={"title": "  "})).status_code == 400
    assert (await authed_client.post(url, json={"title": "x" * 201})).status_code == 400
    assert (await authed_client.post(url, json={"title": "x" * 200})).status_code == 201
