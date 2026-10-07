from uuid import UUID

from litestar import Request, Router, delete, get, patch, post
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Board, BoardColumn, Label
from app.schemas import BoardDetailOut, BoardOut, BoardRequest, ColumnOut, ColumnRequest, CreateLabelRequest, LabelOut
from app.services.boards import add_default_columns, board_detail, columns_of, owned_board
from app.services.labels import ensure_unique_name, label_out, labels_on_board, next_color


def board_out(board: Board) -> BoardOut:
    return BoardOut(id=board.id, name=board.name)


@get("/")
async def list_boards(request: Request, db_session: AsyncSession) -> list[BoardOut]:
    boards = await db_session.scalars(
        select(Board).where(Board.user_id == request.user.id).order_by(Board.created_at, Board.id)
    )
    return [board_out(board) for board in boards]


@post("/")
async def create_board(data: BoardRequest, request: Request, db_session: AsyncSession) -> BoardOut:
    board = Board(user_id=request.user.id, name=data.name.strip())
    db_session.add(board)
    await db_session.flush()
    add_default_columns(db_session, board)
    await db_session.commit()
    return board_out(board)


@get("/{board_id:uuid}")
async def get_board(board_id: UUID, request: Request, db_session: AsyncSession) -> BoardDetailOut:
    board = await owned_board(db_session, request.user.id, board_id)
    return await board_detail(db_session, board)


@patch("/{board_id:uuid}")
async def rename_board(board_id: UUID, data: BoardRequest, request: Request, db_session: AsyncSession) -> BoardOut:
    board = await owned_board(db_session, request.user.id, board_id)
    board.name = data.name.strip()
    await db_session.commit()
    return board_out(board)


@delete("/{board_id:uuid}")
async def delete_board(board_id: UUID, request: Request, db_session: AsyncSession) -> None:
    board = await owned_board(db_session, request.user.id, board_id)
    await db_session.delete(board)
    await db_session.commit()


@post("/{board_id:uuid}/columns")
async def create_column(board_id: UUID, data: ColumnRequest, request: Request, db_session: AsyncSession) -> ColumnOut:
    board = await owned_board(db_session, request.user.id, board_id)
    column = BoardColumn(
        board_id=board.id, name=data.name.strip(), position=len(await columns_of(db_session, board.id))
    )
    db_session.add(column)
    await db_session.commit()
    return ColumnOut(id=column.id, name=column.name, position=column.position, cards=[])


@post("/{board_id:uuid}/labels")
async def create_label(
    board_id: UUID, data: CreateLabelRequest, request: Request, db_session: AsyncSession
) -> LabelOut:
    board = await owned_board(db_session, request.user.id, board_id)
    name = data.name.strip()
    await ensure_unique_name(db_session, board.id, name, None)
    color = data.color or next_color(await labels_on_board(db_session, board.id))
    label = Label(board_id=board.id, name=name, color=color)
    db_session.add(label)
    await db_session.commit()
    return label_out(label)


boards_router = Router(
    path="/api/boards",
    route_handlers=[list_boards, create_board, get_board, rename_board, delete_board, create_column, create_label],
)
