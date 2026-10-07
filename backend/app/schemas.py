import uuid
from datetime import datetime
from typing import Annotated, Literal

import msgspec


# pattern: at least one non-space character, since names and titles are stored stripped.
Name = Annotated[str, msgspec.Meta(pattern=r"\S")]
Title = Annotated[str, msgspec.Meta(pattern=r"\S")]
# Any lead time at all - the only ceiling is what a 64-bit SQLite INTEGER can hold.
MinutesBefore = Annotated[int, msgspec.Meta(ge=0, le=2**63 - 1)]
# The order new labels get their colour in when none is picked: each next one is a hue far from
# the ones before it, so a board's first labels are easy to tell apart at a glance.
LABEL_COLORS = (
    "blue",
    "orange",
    "green",
    "pink",
    "violet",
    "yellow",
    "teal",
    "red",
    "indigo",
    "lime",
    "fuchsia",
    "cyan",
    "amber",
    "purple",
    "emerald",
    "rose",
    "sky",
    "brown",
    "slate",
)
LabelColor = Literal[LABEL_COLORS]  # type: ignore[valid-type]
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


class CreateLabelRequest(msgspec.Struct):
    name: Name
    # Left out, the label gets the colour its board has used least.
    color: LabelColor | None = None


class UpdateLabelRequest(msgspec.Struct):
    name: Name
    color: LabelColor


class LabelOut(msgspec.Struct):
    id: uuid.UUID
    name: str
    color: str


class CreateCardRequest(msgspec.Struct):
    title: Title
    summary: str = ""
    notes: str = ""
    due_at: DueAt | None = None
    reminders: list[MinutesBefore] = []
    labels: list[uuid.UUID] = []


class UpdateCardRequest(msgspec.Struct):
    # A full replacement, not a patch: the card editor always holds every field, and it keeps
    # "clear the due date" (null) from being confused with "leave it alone" (absent).
    title: Title
    summary: str
    notes: str
    due_at: DueAt | None
    reminders: list[MinutesBefore]
    labels: list[uuid.UUID]


class MoveCardRequest(msgspec.Struct):
    column_id: uuid.UUID
    index: Index


class CardOut(msgspec.Struct):
    id: uuid.UUID
    column_id: uuid.UUID
    title: str
    summary: str
    notes: str
    due_at: datetime | None
    # Minutes before due_at, smallest first.
    reminders: list[int]
    # Label ids, in the board's label order.
    labels: list[uuid.UUID]
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
    labels: list[LabelOut]


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
