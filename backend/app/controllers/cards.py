from uuid import UUID

from litestar import Request, Router, delete, post, put
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import CardOut, MoveCardRequest, UpdateCardRequest
from app.services.boards import card_out, cards_of, owned_card, owned_column
from app.services.ordering import place, renumber


@put("/{card_id:uuid}")
async def update_card(card_id: UUID, data: UpdateCardRequest, request: Request, db_session: AsyncSession) -> CardOut:
    card = await owned_card(db_session, request.user.id, card_id)
    if data.due_at != card.due_at:
        card.reminded_at = None
    card.title = data.title.strip()
    card.notes = data.notes
    card.due_at = data.due_at
    await db_session.commit()
    return card_out(card)


@post("/{card_id:uuid}/move")
async def move_card(card_id: UUID, data: MoveCardRequest, request: Request, db_session: AsyncSession) -> CardOut:
    card = await owned_card(db_session, request.user.id, card_id)
    # The target goes through the same ownership check - a card can't be moved onto a column
    # of a board that belongs to someone else.
    target = await owned_column(db_session, request.user.id, data.column_id)
    remaining = [each for each in await cards_of(db_session, card.column_id) if each.id != card.id]
    renumber(remaining)
    if target.id != card.column_id:
        remaining = await cards_of(db_session, target.id)
        card.column_id = target.id
    place(remaining, card, data.index)
    await db_session.commit()
    return card_out(card)


@delete("/{card_id:uuid}")
async def delete_card(card_id: UUID, request: Request, db_session: AsyncSession) -> None:
    card = await owned_card(db_session, request.user.id, card_id)
    await db_session.delete(card)
    await db_session.flush()
    renumber(await cards_of(db_session, card.column_id))
    await db_session.commit()


cards_router = Router(path="/api/cards", route_handlers=[update_card, move_card, delete_card])
