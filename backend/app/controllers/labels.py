from uuid import UUID

from litestar import Request, Router, delete, put
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas import LabelOut, UpdateLabelRequest
from app.services.labels import ensure_unique_name, label_out, owned_label


@put("/{label_id:uuid}")
async def update_label(
    label_id: UUID, data: UpdateLabelRequest, request: Request, db_session: AsyncSession
) -> LabelOut:
    label = await owned_label(db_session, request.user.id, label_id)
    name = data.name.strip()
    await ensure_unique_name(db_session, label.board_id, name, label.id)
    label.name = name
    label.color = data.color
    await db_session.commit()
    return label_out(label)


@delete("/{label_id:uuid}")
async def delete_label(label_id: UUID, request: Request, db_session: AsyncSession) -> None:
    # Its cards just lose it - card_labels cascades.
    label = await owned_label(db_session, request.user.id, label_id)
    await db_session.delete(label)
    await db_session.commit()


labels_router = Router(path="/api/labels", route_handlers=[update_label, delete_label])
