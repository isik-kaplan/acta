from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Connection, DateTime, TypeDecorator, event, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


class Base(DeclarativeBase):
    pass


class UTCDateTime(TypeDecorator):
    """SQLite has no zone-aware DATETIME: SQLAlchemy writes an aware value's wall-clock digits and
    drops its offset, so 09:00+02:00 and 09:00Z would land as the same string and compare equal.
    Everything is converted to UTC on the way in, and comes back out tagged as UTC. Only aware
    values go in: the request schemas require a zone, and the app's own clock is utcnow()."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        return value.replace(tzinfo=UTC)


def _enforce_foreign_keys(dbapi_connection, connection_record) -> None:
    # SQLite ships with foreign keys off, per connection. Deleting a board relies on ON DELETE
    # CASCADE to take its columns, cards and nothing else with it - the models declare no ORM
    # relationships to cascade through instead.
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def _make_engine():
    database_path = Path(settings.DATABASE_PATH)
    database_path.parent.mkdir(parents=True, exist_ok=True)
    made = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    event.listen(made.sync_engine, "connect", _enforce_foreign_keys)
    return made


engine = _make_engine()
session_factory = async_sessionmaker(engine, expire_on_commit=False)


def _add_card_summary_column_if_missing(connection: Connection) -> None:
    # create_all never alters a table that already exists, so a database from before cards had a
    # summary needs it added here instead of through a full migration framework.
    columns = {column["name"] for column in inspect(connection).get_columns("cards")}
    if "summary" not in columns:
        connection.execute(text("ALTER TABLE cards ADD COLUMN summary TEXT NOT NULL DEFAULT ''"))


def _move_reminded_at_to_card_reminders(connection: Connection) -> None:
    # Cards once had a single at-the-due-time reminder, tracked by cards.reminded_at. Each dated
    # card keeps that as a 0-minutes-before reminder (already sent if it had been), and the old
    # column goes. Runs after create_all, so card_reminders exists by now.
    columns = {column["name"] for column in inspect(connection).get_columns("cards")}
    if "reminded_at" not in columns:
        return
    connection.execute(
        text(
            "INSERT INTO card_reminders (id, card_id, minutes_before, sent_at) "
            "SELECT lower(hex(randomblob(16))), id, 0, reminded_at FROM cards WHERE due_at IS NOT NULL"
        )
    )
    connection.execute(text("ALTER TABLE cards DROP COLUMN reminded_at"))


def _add_session_version_column_if_missing(connection: Connection) -> None:
    columns = {column["name"] for column in inspect(connection).get_columns("users")}
    if "session_version" not in columns:
        connection.execute(text("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0"))


async def create_tables() -> None:
    import app.models  # noqa: F401 - registers the tables on Base.metadata

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        await connection.run_sync(_add_card_summary_column_if_missing)
        await connection.run_sync(_move_reminded_at_to_card_reminders)
        await connection.run_sync(_add_session_version_column_if_missing)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session
