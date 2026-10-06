from litestar import Request, Router, get, post
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


@post("/subscriptions")
async def subscribe(data: PushSubscriptionRequest, request: Request, db_session: AsyncSession) -> Response:
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
