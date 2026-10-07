import uuid as uuid_module
from datetime import UTC, datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint, Uuid
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
    display_name: Mapped[str] = mapped_column(Text)
    # Stamped into every session cookie and bumped on a password change: the cookie is
    # self-contained (nothing is stored server side to delete), so this is what lets one change
    # sign out every other device holding an older cookie.
    session_version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Board(Base):
    __tablename__ = "boards"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    user_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class BoardColumn(Base):
    __tablename__ = "board_columns"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    board_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(Text)
    # Dense, 0-based within the board - app/services/ordering.py renumbers on every move/delete.
    position: Mapped[int]


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    column_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("board_columns.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(Text)
    # One line shown on the tile under the title; notes are the full write-up, only in the editor.
    summary: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    due_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, default=None, index=True)
    position: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Label(Base):
    """A board's own label - every card on the board picks from the same list."""

    __tablename__ = "labels"

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    board_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(Text)
    # One of app.schemas.LABEL_COLORS - a name, not a value: the frontend maps it to a light and a
    # dark-mode pair, so the same label reads well in either theme.
    color: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class CardLabel(Base):
    __tablename__ = "card_labels"

    card_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True)
    label_id: Mapped[uuid_module.UUID] = mapped_column(
        ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True, index=True
    )


class CardReminder(Base):
    """One "this long before it's due" push for a card - 0 is at the due time itself."""

    __tablename__ = "card_reminders"
    __table_args__ = (UniqueConstraint("card_id", "minutes_before"),)

    id: Mapped[uuid_module.UUID] = mapped_column(Uuid, primary_key=True, default=_uuid7)
    card_id: Mapped[uuid_module.UUID] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    minutes_before: Mapped[int]
    # Set once this push has gone out, so the reminder loop sends each one exactly once. Cleared
    # whenever the card's due_at changes, which re-arms it for the new time.
    sent_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, default=None)


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
