from uuid import UUID

from litestar import Request, Router, delete, patch, post
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Card
from app.schemas import BoardDetailOut, CardOut, ColumnRequest, CreateCardRequest, MoveColumnRequest
from app.services.boards import (
    board_detail,
    cards_of,
    columns_of,
    owned_board,
    owned_column,
    set_reminders,
    single_card_out,
)
from app.services.labels import set_card_labels
from app.services.ordering import place, renumber


@patch("/{column_id:uuid}")
async def rename_column(
    column_id: UUID, data: ColumnRequest, request: Request, db_session: AsyncSession
) -> BoardDetailOut:
    column = await owned_column(db_session, request.user.id, column_id)
    column.name = data.name.strip()
    await db_session.commit()
    return await board_detail(db_session, await owned_board(db_session, request.user.id, column.board_id))


@post("/{column_id:uuid}/move")
async def move_column(
    column_id: UUID, data: MoveColumnRequest, request: Request, db_session: AsyncSession
) -> BoardDetailOut:
    column = await owned_column(db_session, request.user.id, column_id)
    others = [each for each in await columns_of(db_session, column.board_id) if each.id != column.id]
    place(others, column, data.index)
    await db_session.commit()
    return await board_detail(db_session, await owned_board(db_session, request.user.id, column.board_id))


@delete("/{column_id:uuid}")
async def delete_column(column_id: UUID, request: Request, db_session: AsyncSession) -> None:
    column = await owned_column(db_session, request.user.id, column_id)
    await db_session.delete(column)
    await db_session.flush()
    renumber(await columns_of(db_session, column.board_id))
    await db_session.commit()


@post("/{column_id:uuid}/cards")
async def create_card(column_id: UUID, data: CreateCardRequest, request: Request, db_session: AsyncSession) -> CardOut:
    column = await owned_column(db_session, request.user.id, column_id)
    card = Card(
        column_id=column.id,
        title=data.title.strip(),
        summary=data.summary.strip(),
        notes=data.notes,
        due_at=data.due_at,
        position=len(await cards_of(db_session, column.id)),
    )
    db_session.add(card)
    await db_session.flush()
    await set_reminders(db_session, card, data.reminders, due_changed=False)
    await set_card_labels(db_session, card.id, column.board_id, data.labels)
    out = await single_card_out(db_session, card)
    await db_session.commit()
    return out


columns_router = Router(
    path="/api/columns",
    route_handlers=[rename_column, move_column, delete_column, create_card],
)
