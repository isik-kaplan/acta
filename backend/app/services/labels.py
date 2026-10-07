from collections import Counter
from uuid import UUID

from litestar.exceptions import HTTPException, NotFoundException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Board, CardLabel, Label
from app.schemas import LABEL_COLORS, LabelOut


async def owned_label(db_session: AsyncSession, user_id: UUID, label_id: UUID) -> Label:
    label = await db_session.scalar(select(Label).join(Board).where(Label.id == label_id, Board.user_id == user_id))
    if label is None:
        raise NotFoundException("No label found with this id.")
    return label


async def labels_on_board(db_session: AsyncSession, board_id: UUID) -> list[Label]:
    return list(
        await db_session.scalars(select(Label).where(Label.board_id == board_id).order_by(Label.created_at, Label.id))
    )


def label_out(label: Label) -> LabelOut:
    return LabelOut(id=label.id, name=label.name, color=label.color)


def next_color(labels: list[Label]) -> str:
    """The colour the board has used least, earliest in LABEL_COLORS on a tie - so labels walk the
    palette in order, and start over at its far-apart hues once every colour is taken."""
    used = Counter(label.color for label in labels)
    return min(LABEL_COLORS, key=lambda color: (used[color], LABEL_COLORS.index(color)))


async def ensure_unique_name(db_session: AsyncSession, board_id: UUID, name: str, label_id: UUID | None) -> None:
    # Two labels a card editor can't tell apart are no use, so "Urgent" and "urgent" are one name.
    clash = await db_session.scalar(
        select(Label.id).where(Label.board_id == board_id, func.lower(Label.name) == name.lower(), Label.id != label_id)
    )
    if clash is not None:
        raise HTTPException(status_code=409, detail=f'There is already a label called "{name}" on this board.')


async def set_card_labels(db_session: AsyncSession, card_id: UUID, board_id: UUID, label_ids: list[UUID]) -> None:
    """Makes the card's labels exactly `label_ids`, every one of which must be on `board_id`."""
    wanted = set(label_ids)
    found = set(await db_session.scalars(select(Label.id).where(Label.id.in_(wanted), Label.board_id == board_id)))
    if found != wanted:
        # Someone else's label, or one from another board, answers like a missing one.
        raise NotFoundException("No label found with this id.")
    await db_session.execute(delete(CardLabel).where(CardLabel.card_id == card_id))
    db_session.add_all(CardLabel(card_id=card_id, label_id=label_id) for label_id in wanted)


async def labels_of(db_session: AsyncSession, card_ids: list[UUID]) -> dict[UUID, list[UUID]]:
    rows = await db_session.execute(
        select(CardLabel.card_id, Label.id, Label.created_at).join(Label).where(CardLabel.card_id.in_(card_ids))
    )
    found: dict[UUID, list[UUID]] = {card_id: [] for card_id in card_ids}
    # Sorted here, in the same order labels_on_board lists them, rather than left to whichever
    # index SQLite happens to walk the join through.
    for card_id, label_id, _ in sorted(rows, key=lambda row: (row.created_at, row.id)):
        found[card_id].append(label_id)
    return found
