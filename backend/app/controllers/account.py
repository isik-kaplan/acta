from litestar import Request, Router, post
from litestar.exceptions import NotAuthorizedException
from litestar.response import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password, session_for, verify_password
from app.models import User
from app.schemas import ChangePasswordRequest


@post("/password")
async def change_password(data: ChangePasswordRequest, request: Request, db_session: AsyncSession) -> Response:
    # request.user was loaded by a session that's already closed - reloaded into this request's
    # own session so the change is tracked and committed.
    user = await db_session.get(User, request.user.id)
    if not verify_password(data.current_password, user.password_hash):
        raise NotAuthorizedException("Current password is incorrect.")
    user.password_hash = hash_password(data.new_password)
    # Every other device is signed out; this one gets a fresh cookie and stays in.
    user.session_version += 1
    await db_session.commit()
    request.set_session(session_for(user))
    return Response(content=None, status_code=204)


account_router = Router(path="/api/account", route_handlers=[change_password])
