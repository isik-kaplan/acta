from datetime import UTC, datetime, timedelta, timezone

from hypothesis import given
from hypothesis import strategies as st
from sqlalchemy import select, text

from app.db import UTCDateTime, create_tables, engine, get_db_session, session_factory
from app.models import CardReminder


# Fixed offsets, the only kind a request can carry - a named zone's ambiguous DST hour never
# compares equal to anything across zones, which says nothing about this column.
OFFSETS = st.builds(timezone, st.timedeltas(min_value=timedelta(hours=-23), max_value=timedelta(hours=23)))
AWARE = st.datetimes(min_value=datetime(1970, 1, 2), max_value=datetime(9998, 1, 1), timezones=OFFSETS)


@given(AWARE)
def test_utc_datetime_round_trips_the_same_instant_as_utc(value) -> None:
    column = UTCDateTime()
    stored = column.process_bind_param(value, None)
    assert stored.tzinfo is None
    loaded = column.process_result_value(stored, None)
    assert loaded == value
    assert loaded.tzinfo is UTC


def test_utc_datetime_stores_the_utc_wall_clock() -> None:
    value = datetime(2026, 10, 6, 14, 0, tzinfo=timezone(timedelta(hours=2)))
    assert UTCDateTime().process_bind_param(value, None) == datetime(2026, 10, 6, 12, 0)


def test_utc_datetime_passes_null_through() -> None:
    assert UTCDateTime().process_bind_param(None, None) is None
    assert UTCDateTime().process_result_value(None, None) is None


async def test_foreign_keys_are_enforced_on_every_connection() -> None:
    async with engine.connect() as connection:
        assert (await connection.execute(text("PRAGMA foreign_keys"))).scalar() == 1


async def test_get_db_session_yields_a_working_session() -> None:
    sessions = get_db_session()
    session = await anext(sessions)
    assert (await session.execute(text("SELECT 1"))).scalar() == 1
    await sessions.aclose()


def test_make_engine_creates_missing_parent_directories(tmp_path, monkeypatch) -> None:
    from app import db

    path = tmp_path / "deep" / "er" / "acta.sqlite3"
    monkeypatch.setattr(db.settings, "DATABASE_PATH", str(path))
    made = db._make_engine()
    assert path.parent.is_dir()
    made.sync_engine.dispose()


async def columns_of_cards() -> set[str]:
    async with engine.connect() as connection:
        return {row[1] for row in (await connection.execute(text("PRAGMA table_info(cards)"))).all()}


async def test_create_tables_runs_again_on_a_current_database(authed_client, board) -> None:
    await authed_client.post(f"/api/columns/{board['columns'][0]['id']}/cards", json={"title": "x", "reminders": [0]})
    await create_tables()
    await create_tables()
    async with engine.connect() as connection:
        assert (await connection.execute(text("SELECT count(*) FROM card_reminders"))).scalar() == 1
    assert "summary" in await columns_of_cards()
    assert "reminded_at" not in await columns_of_cards()


async def test_create_tables_gives_cards_from_before_summaries_an_empty_one(authed_client, board) -> None:
    column_id = board["columns"][0]["id"]
    await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": "old"})
    async with engine.begin() as connection:
        await connection.execute(text("ALTER TABLE cards DROP COLUMN summary"))
    await create_tables()
    card = (await authed_client.get(f"/api/boards/{board['id']}")).json()["columns"][0]["cards"][0]
    assert card["summary"] == ""
    edited = await authed_client.put(
        f"/api/cards/{card['id']}",
        json={"title": "old", "summary": "s", "notes": "", "due_at": None, "reminders": [], "labels": []},
    )
    assert edited.json()["summary"] == "s"


async def test_create_tables_turns_reminded_at_into_at_due_time_reminders(authed_client, board) -> None:
    column_id = board["columns"][0]["id"]
    created = {}
    for title, due_at in (("sent", "2026-10-06T10:00:00Z"), ("pending", "2026-10-09T10:00:00Z"), ("undated", None)):
        response = await authed_client.post(f"/api/columns/{column_id}/cards", json={"title": title, "due_at": due_at})
        created[title] = response.json()["id"]
    async with engine.begin() as connection:
        await connection.execute(text("ALTER TABLE cards ADD COLUMN reminded_at DATETIME"))
        await connection.execute(
            text("UPDATE cards SET reminded_at = '2026-10-06 10:00:05.000000' WHERE title = 'sent'")
        )
    await create_tables()

    assert "reminded_at" not in await columns_of_cards()
    async with session_factory() as db_session:
        rows = (await db_session.scalars(select(CardReminder))).all()
    by_card = {str(row.card_id): (row.minutes_before, row.sent_at) for row in rows}
    assert by_card == {
        created["sent"]: (0, datetime(2026, 10, 6, 10, 0, 5, tzinfo=UTC)),
        created["pending"]: (0, None),
    }
    assert len({row.id for row in rows}) == 2
    detail = (await authed_client.get(f"/api/boards/{board['id']}")).json()
    assert [card["reminders"] for card in detail["columns"][0]["cards"]] == [[0], [0], []]


async def test_create_tables_gives_users_from_before_session_versions_version_zero(client) -> None:
    from tests.conftest import register

    await register(client)
    async with engine.begin() as connection:
        await connection.execute(text("ALTER TABLE users DROP COLUMN session_version"))
    await create_tables()
    async with engine.connect() as connection:
        assert (await connection.execute(text("SELECT session_version FROM users"))).scalars().all() == [0]
    # The cookie from registering still works afterwards.
    assert (await client.get("/api/auth/me")).status_code == 200
