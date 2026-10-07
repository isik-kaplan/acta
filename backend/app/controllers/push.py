from urllib.parse import urlsplit

from litestar import Request, Router, get, post
from litestar.exceptions import ValidationException
from litestar.response import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PushSubscription
from app.schemas import PushKeyOut, PushSubscriptionRequest, PushTestOut, PushUnsubscribeRequest
from app.services.push import notify_user
from app.services.vapid import vapid_keys


@get("/public-key")
async def public_key() -> PushKeyOut:
    return PushKeyOut(public_key=vapid_keys().public_key)


# Where browsers' push services live - Chrome, Edge (and every other Chromium) on FCM, Firefox on
# Mozilla's autopush, Safari on Apple's, legacy Edge on WNS. The server POSTs to whatever endpoint
# is stored, so anything else (an internal address, localhost, a cloud metadata URL) is refused
# rather than requested on a logged-in user's say-so.
PUSH_SERVICE_DOMAINS = (
    "fcm.googleapis.com",
    "android.googleapis.com",
    "push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
)


def is_push_service(endpoint: str) -> bool:
    try:
        parts = urlsplit(endpoint)
        port = parts.port
    except ValueError:
        return False
    host = parts.hostname
    if host is None:
        return False
    return (
        parts.scheme == "https"
        and port in (None, 443)
        and any(host == domain or host.endswith(f".{domain}") for domain in PUSH_SERVICE_DOMAINS)
    )


@post("/subscriptions")
async def subscribe(data: PushSubscriptionRequest, request: Request, db_session: AsyncSession) -> Response:
    if not is_push_service(data.endpoint):
        raise ValidationException("That isn't a browser push service's address.")
    subscription = await db_session.scalar(select(PushSubscription).where(PushSubscription.endpoint == data.endpoint))
    if subscription is None:
        subscription = PushSubscription(endpoint=data.endpoint)
        db_session.add(subscription)
    # A device that changes hands (log out, someone else logs in) follows the new account.
    subscription.user_id = request.user.id
    subscription.p256dh = data.keys.p256dh
    subscription.auth = data.keys.auth
    await db_session.commit()
    return Response(content=None, status_code=204)


@post("/unsubscribe")
async def unsubscribe(data: PushUnsubscribeRequest, request: Request, db_session: AsyncSession) -> Response:
    await db_session.execute(
        delete(PushSubscription).where(
            PushSubscription.endpoint == data.endpoint, PushSubscription.user_id == request.user.id
        )
    )
    await db_session.commit()
    return Response(content=None, status_code=204)


@post("/test")
async def send_test(request: Request, db_session: AsyncSession) -> PushTestOut:
    sent = await notify_user(
        db_session,
        request.user.id,
        {"title": "acta", "body": "Notifications are working.", "url": "/settings", "tag": "test"},
    )
    await db_session.commit()
    return PushTestOut(sent=sent)


push_router = Router(path="/api/push", route_handlers=[public_key, subscribe, unsubscribe, send_test])
