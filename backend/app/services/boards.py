from datetime import UTC
from uuid import UUID

from litestar.exceptions import NotFoundException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Board, BoardColumn, Card, CardReminder
from app.schemas import BoardDetailOut, CardOut, ColumnOut
from app.services.labels import label_out, labels_of, labels_on_board


DEFAULT_COLUMNS = ("To do", "Doing", "Done")


async def owned_board(db_session: AsyncSession, user_id: UUID, board_id: UUID) -> Board:
    board = await db_session.get(Board, board_id)
    # Someone else's board answers exactly like a missing one, so ids can't be probed.
    if board is None or board.user_id != user_id:
        raise NotFoundException("No board found with this id.")
    return board


async def owned_column(db_session: AsyncSession, user_id: UUID, column_id: UUID) -> BoardColumn:
    column = await db_session.scalar(
        select(BoardColumn).join(Board).where(BoardColumn.id == column_id, Board.user_id == user_id)
    )
    if column is None:
        raise NotFoundException("No column found with this id.")
    return column


async def owned_card(db_session: AsyncSession, user_id: UUID, card_id: UUID) -> Card:
    card = await db_session.scalar(
        select(Card).join(BoardColumn).join(Board).where(Card.id == card_id, Board.user_id == user_id)
    )
    if card is None:
        raise NotFoundException("No card found with this id.")
    return card


async def columns_of(db_session: AsyncSession, board_id: UUID) -> list[BoardColumn]:
    return list(
        await db_session.scalars(
            select(BoardColumn).where(BoardColumn.board_id == board_id).order_by(BoardColumn.position)
        )
    )


async def cards_of(db_session: AsyncSession, column_id: UUID) -> list[Card]:
    return list(await db_session.scalars(select(Card).where(Card.column_id == column_id).order_by(Card.position)))


def add_default_columns(db_session: AsyncSession, board: Board) -> None:
    for position, name in enumerate(DEFAULT_COLUMNS):
        db_session.add(BoardColumn(board_id=board.id, name=name, position=position))


async def reminders_of(db_session: AsyncSession, card_ids: list[UUID]) -> dict[UUID, list[int]]:
    rows = await db_session.scalars(
        select(CardReminder).where(CardReminder.card_id.in_(card_ids)).order_by(CardReminder.minutes_before)
    )
    found: dict[UUID, list[int]] = {card_id: [] for card_id in card_ids}
    for reminder in rows:
        found[reminder.card_id].append(reminder.minutes_before)
    return found


async def set_reminders(db_session: AsyncSession, card: Card, minutes: list[int], due_changed: bool) -> None:
    """Makes the card's reminders exactly `minutes`. One that stays keeps whether it was already
    sent, unless the due time moved - then every one of them is due again."""
    wanted = set(minutes)
    existing = await db_session.scalars(select(CardReminder).where(CardReminder.card_id == card.id))
    for reminder in existing:
        if reminder.minutes_before not in wanted:
            await db_session.delete(reminder)
            continue
        wanted.discard(reminder.minutes_before)
        if due_changed:
            reminder.sent_at = None
    for minutes_before in wanted:
        db_session.add(CardReminder(card_id=card.id, minutes_before=minutes_before))


async def single_card_out(db_session: AsyncSession, card: Card) -> CardOut:
    await db_session.flush()
    reminders = await reminders_of(db_session, [card.id])
    labels = await labels_of(db_session, [card.id])
    return card_out(card, reminders[card.id], labels[card.id])


def card_out(card: Card, reminders: list[int], labels: list[UUID]) -> CardOut:
    return CardOut(
        id=card.id,
        column_id=card.column_id,
        title=card.title,
        summary=card.summary,
        notes=card.notes,
        # A card fresh from a request still holds the zone it was sent in; one read back from the
        # database is UTC. Same instant either way, but the API answers in one form.
        due_at=card.due_at and card.due_at.astimezone(UTC),
        position=card.position,
        reminders=reminders,
        labels=labels,
    )


async def board_detail(db_session: AsyncSession, board: Board) -> BoardDetailOut:
    columns = await columns_of(db_session, board.id)
    cards = list(
        await db_session.scalars(
            select(Card).join(BoardColumn).where(BoardColumn.board_id == board.id).order_by(Card.position)
        )
    )
    card_ids = [card.id for card in cards]
    reminders = await reminders_of(db_session, card_ids)
    labels = await labels_of(db_session, card_ids)
    return BoardDetailOut(
        id=board.id,
        name=board.name,
        columns=[
            ColumnOut(
                id=column.id,
                name=column.name,
                position=column.position,
                cards=[
                    card_out(card, reminders[card.id], labels[card.id]) for card in cards if card.column_id == column.id
                ],
            )
            for column in columns
        ],
        labels=[label_out(label) for label in await labels_on_board(db_session, board.id)],
    )
