import uuid as uuid_module
from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from uuid6 import uuid7

from app.db import Base, UTCDateTime


def utcnow() -> datetime:
    return datetime.now(UTC)


def _uuid7() -> uuid_module.UUID:
    return uuid7()


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    user_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class BoardColumn(Base):
    __tablename__ = "board_columns"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    board_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    # Dense, 0-based within the board - app/services/ordering.py renumbers on every move/delete.
    position: Mapped[int]


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    column_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("board_columns.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="")
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, default=None, index=True)
    # Set once the due-date push has gone out, so the reminder loop sends each one exactly once.
    # Cleared whenever due_at changes, which re-arms it for the new time.
    reminded_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, default=None)
    position: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class PushSubscription(Base):
    """One browser/device that opted in to notifications. The endpoint URL is the device's
    identity: subscribing again from the same device updates the row rather than adding one."""

    __tablename__ = "push_subscriptions"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    user_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    endpoint: Mapped[str] = mapped_column(Text, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255))
    auth: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
