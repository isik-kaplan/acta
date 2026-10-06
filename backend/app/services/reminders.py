import asyncio
import logging
from datetime import datetime

from sqlalchemy import select

from app.db import session_factory
from app.models import Board, BoardColumn, Card, utcnow
from app.services.push import notify_user


logger = logging.getLogger(__name__)


def reminder_payload(card: Card, board: Board) -> dict:
    return {
        "title": card.title,
        "body": f"Due now · {board.name}",
        "url": f"/boards/{board.id}?card={card.id}",
        # Same tag for the same card, so a re-armed reminder replaces its old notification
        # instead of stacking a second one beside it.
        "tag": f"card-{card.id}",
    }


async def send_due_reminders(now: datetime | None = None) -> int:
    """One pass: every card whose due time has come and that hasn't been reminded yet. Returns
    how many cards were reminded."""
    now = now or utcnow()
    async with session_factory() as db_session:
        rows = (
            await db_session.execute(
                select(Card, Board)
                .select_from(Card)
                .join(BoardColumn)
                .join(Board)
                .where(Card.due_at <= now, Card.reminded_at.is_(None))
            )
        ).all()
        for card, board in rows:
            await notify_user(db_session, board.user_id, reminder_payload(card, board))
            card.reminded_at = now
        await db_session.commit()
    return len(rows)


async def run_reminders(interval: float) -> None:
    while True:
        try:
            await send_due_reminders()
        except Exception:
            # A failed pass (a locked database, a bug on one odd card) must not end the loop for
            # good - the next pass gets another go at the same cards.
            logger.exception("Reminder pass failed")
        await asyncio.sleep(interval)
