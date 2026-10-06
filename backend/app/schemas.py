import uuid
from datetime import datetime
from typing import Annotated

import msgspec


# pattern: at least one non-space character, since names and titles are stored stripped.
Name = Annotated[str, msgspec.Meta(max_length=120, pattern=r"\S")]
Title = Annotated[str, msgspec.Meta(max_length=200, pattern=r"\S")]
Notes = Annotated[str, msgspec.Meta(max_length=10_000)]
Password = Annotated[str, msgspec.Meta(min_length=8, max_length=256)]
Index = Annotated[int, msgspec.Meta(ge=0)]
# Zone required: a bare "09:00" means a different moment on the phone than on the server.
DueAt = Annotated[datetime, msgspec.Meta(tz=True)]


class RegisterRequest(msgspec.Struct):
    email: str
    password: Password
    display_name: Name


class LoginRequest(msgspec.Struct):
    email: str
    password: str


class ChangePasswordRequest(msgspec.Struct):
    current_password: str
    new_password: Password


class UserOut(msgspec.Struct):
    id: uuid.UUID
    email: str
    display_name: str


class BoardRequest(msgspec.Struct):
    name: Name


class BoardOut(msgspec.Struct):
    id: uuid.UUID
    name: str


class ColumnRequest(msgspec.Struct):
    name: Name


class MoveColumnRequest(msgspec.Struct):
    index: Index


class CreateCardRequest(msgspec.Struct):
    title: Title
    notes: Notes = ""
    due_at: DueAt | None = None


class UpdateCardRequest(msgspec.Struct):
    # A full replacement, not a patch: the card editor always holds every field, and it keeps
    # "clear the due date" (null) from being confused with "leave it alone" (absent).
    title: Title
    notes: Notes
    due_at: DueAt | None


class MoveCardRequest(msgspec.Struct):
    column_id: uuid.UUID
    index: Index


class CardOut(msgspec.Struct):
    id: uuid.UUID
    column_id: uuid.UUID
    title: str
    notes: str
    due_at: datetime | None
    position: int


class ColumnOut(msgspec.Struct):
    id: uuid.UUID
    name: str
    position: int
    cards: list[CardOut]


class BoardDetailOut(msgspec.Struct):
    id: uuid.UUID
    name: str
    columns: list[ColumnOut]


class PushKeys(msgspec.Struct):
    p256dh: str
    auth: str


class PushSubscriptionRequest(msgspec.Struct):
    # The shape of the browser's own PushSubscription.toJSON(), so the client can post it as is.
    endpoint: str
    keys: PushKeys


class PushUnsubscribeRequest(msgspec.Struct):
    endpoint: str


class PushKeyOut(msgspec.Struct):
    public_key: str


class PushTestOut(msgspec.Struct):
    sent: int
