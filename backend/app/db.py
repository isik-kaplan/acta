from collections.abc import AsyncIterator
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import DateTime, TypeDecorator, event
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


async def create_tables() -> None:
    import app.models  # noqa: F401 - registers the tables on Base.metadata

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        yield session
