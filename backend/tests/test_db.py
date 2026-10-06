from datetime import UTC, datetime, timedelta, timezone

from hypothesis import given
from hypothesis import strategies as st
from sqlalchemy import text

from app.db import UTCDateTime, engine, get_db_session


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
