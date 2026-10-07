from uuid import UUID

from litestar import Request, Router, delete, post, put
from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BoardColumn, CardLabel
from app.schemas import CardOut, MoveCardRequest, UpdateCardRequest
from app.services.boards import cards_of, owned_card, owned_column, set_reminders, single_card_out
from app.services.labels import set_card_labels
from app.services.ordering import place, renumber


@put("/{card_id:uuid}")
async def update_card(card_id: UUID, data: UpdateCardRequest, request: Request, db_session: AsyncSession) -> CardOut:
    card = await owned_card(db_session, request.user.id, card_id)
    due_changed = data.due_at != card.due_at
    card.title = data.title.strip()
    card.summary = data.summary.strip()
    card.notes = data.notes
    card.due_at = data.due_at
    await set_reminders(db_session, card, data.reminders, due_changed)
    column = await db_session.get(BoardColumn, card.column_id)
    await set_card_labels(db_session, card.id, column.board_id, data.labels)
    out = await single_card_out(db_session, card)
    await db_session.commit()
    return out


@post("/{card_id:uuid}/move")
async def move_card(card_id: UUID, data: MoveCardRequest, request: Request, db_session: AsyncSession) -> CardOut:
    card = await owned_card(db_session, request.user.id, card_id)
    # The target goes through the same ownership check - a card can't be moved onto a column
    # of a board that belongs to someone else.
    target = await owned_column(db_session, request.user.id, data.column_id)
    remaining = [each for each in await cards_of(db_session, card.column_id) if each.id != card.id]
    renumber(remaining)
    if target.id != card.column_id:
        source = await db_session.get(BoardColumn, card.column_id)
        if source.board_id != target.board_id:
            # Labels belong to a board, so none of them can come along onto another one.
            await db_session.execute(sql_delete(CardLabel).where(CardLabel.card_id == card.id))
        remaining = await cards_of(db_session, target.id)
        card.column_id = target.id
    place(remaining, card, data.index)
    out = await single_card_out(db_session, card)
    await db_session.commit()
    return out


@delete("/{card_id:uuid}")
async def delete_card(card_id: UUID, request: Request, db_session: AsyncSession) -> None:
    card = await owned_card(db_session, request.user.id, card_id)
    await db_session.delete(card)
    await db_session.flush()
    renumber(await cards_of(db_session, card.column_id))
    await db_session.commit()


cards_router = Router(path="/api/cards", route_handlers=[update_card, move_card, delete_card])
