import json
import logging
from uuid import UUID

import anyio
from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import PushSubscription
from app.services.vapid import vapid_keys


logger = logging.getLogger(__name__)

# What a push service answers for a subscription the browser has dropped (app uninstalled,
# permission revoked, site data cleared) - it will never accept a message again.
GONE_STATUSES = (404, 410)


def deliver(subscription: PushSubscription, payload: dict) -> bool:
    """Sends one push. False only when the subscription is gone for good; any other failure is
    logged and the subscription kept, since a push service's bad minute shouldn't unsubscribe a
    device."""
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=vapid_keys().private_key,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=60 * 60 * 24,
        )
    except WebPushException as error:
        if error.response is not None and error.response.status_code in GONE_STATUSES:
            return False
        logger.warning("Push to %s failed: %s", subscription.endpoint, error)
    return True


async def notify_user(db_session: AsyncSession, user_id: UUID, payload: dict) -> int:
    """Pushes `payload` to every device the user subscribed, drops the ones that are gone, and
    returns how many were still there. The caller commits."""
    subscriptions = list(await db_session.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id)))
    delivered = 0
    for subscription in subscriptions:
        # webpush is a blocking requests call - off the event loop so one slow push service
        # doesn't stall every other request.
        if await anyio.to_thread.run_sync(deliver, subscription, payload):
            delivered += 1
        else:
            await db_session.delete(subscription)
    return delivered
