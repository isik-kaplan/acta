import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.db import session_factory
from app.models import Board, BoardColumn, Card, CardReminder, utcnow
from app.services.push import notify_user


logger = logging.getLogger(__name__)


UNITS = ((10_080, "week"), (1_440, "day"), (60, "hour"), (1, "minute"))


def lead_time(minutes_before: int) -> str:
    if minutes_before == 0:
        return "Due now"
    size, unit = next((size, unit) for size, unit in UNITS if minutes_before % size == 0)
    count = minutes_before // size
    return f"Due in {count} {unit}{'' if count == 1 else 's'}"


def is_due(due_at: datetime, minutes_before: int, now: datetime) -> bool:
    # Compared in whole microseconds rather than as due_at - timedelta(...): a lead time can be far
    # longer than a datetime or timedelta can represent, and such a reminder is simply already due.
    return (due_at - now) // timedelta(microseconds=1) <= minutes_before * 60_000_000


def reminder_payload(card: Card, board: Board, minutes_before: int) -> dict:
    return {
        "title": card.title,
        "body": f"{lead_time(minutes_before)} · {board.name}",
        "url": f"/boards/{board.id}?card={card.id}",
        # Same tag for the same card, so each reminder replaces the card's last notification
        # instead of stacking up beside it.
        "tag": f"card-{card.id}",
    }


async def send_due_reminders(now: datetime | None = None) -> int:
    """One pass: every reminder whose time has come and that hasn't gone out yet. Returns how many
    were sent."""
    now = now or utcnow()
    async with session_factory() as db_session:
        rows = (
            await db_session.execute(
                select(CardReminder, Card, Board)
                .select_from(CardReminder)
                .join(Card)
                .join(BoardColumn)
                .join(Board)
                .where(CardReminder.sent_at.is_(None), Card.due_at.is_not(None))
                # Furthest-ahead first: after a gap several can be due at once, and the one that
                # lands last (and replaces the rest, by tag) should be the most urgent.
                .order_by(CardReminder.minutes_before.desc())
            )
        ).all()
        due = [row for row in rows if is_due(row[1].due_at, row[0].minutes_before, now)]
        for reminder, card, board in due:
            await notify_user(db_session, board.user_id, reminder_payload(card, board, reminder.minutes_before))
            reminder.sent_at = now
        await db_session.commit()
    return len(due)


async def run_reminders(interval: float) -> None:
    while True:
        try:
            await send_due_reminders()
        except Exception:
            # A failed pass (a locked database, a bug on one odd card) must not end the loop for
            # good - the next pass gets another go at the same cards.
            logger.exception("Reminder pass failed")
        await asyncio.sleep(interval)
