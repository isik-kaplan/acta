from datetime import UTC
from uuid import UUID

from litestar.exceptions import NotFoundException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Board, BoardColumn, Card
from app.schemas import BoardDetailOut, CardOut, ColumnOut


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


def card_out(card: Card) -> CardOut:
    return CardOut(
        id=card.id,
        column_id=card.column_id,
        title=card.title,
        notes=card.notes,
        # A card fresh from a request still holds the zone it was sent in; one read back from the
        # database is UTC. Same instant either way, but the API answers in one form.
        due_at=card.due_at and card.due_at.astimezone(UTC),
        position=card.position,
    )


async def board_detail(db_session: AsyncSession, board: Board) -> BoardDetailOut:
    columns = await columns_of(db_session, board.id)
    cards = list(
        await db_session.scalars(
            select(Card).join(BoardColumn).where(BoardColumn.board_id == board.id).order_by(Card.position)
        )
    )
    return BoardDetailOut(
        id=board.id,
        name=board.name,
        columns=[
            ColumnOut(
                id=column.id,
                name=column.name,
                position=column.position,
                cards=[card_out(card) for card in cards if card.column_id == column.id],
            )
            for column in columns
        ],
    )
