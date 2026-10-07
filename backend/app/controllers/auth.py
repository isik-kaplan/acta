from litestar import Request, Router, get, post
from litestar.exceptions import NotAuthorizedException, NotFoundException, PermissionDeniedException
from litestar.response import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password, session_for, verify_password
from app.config import settings
from app.models import Board, User
from app.schemas import LoginRequest, RegisterRequest, UserOut
from app.services.boards import add_default_columns


def user_out(user: User) -> UserOut:
    return UserOut(id=user.id, email=user.email, display_name=user.display_name)


def _normalized_email(email: str) -> str:
    return email.strip().lower()


@post("/register")
async def register(data: RegisterRequest, request: Request, db_session: AsyncSession) -> UserOut:
    if not settings.REGISTRATION_ENABLED:
        raise NotFoundException("Registration is currently disabled.")

    email = _normalized_email(data.email)
    if await db_session.scalar(select(User).where(User.email == email)) is not None:
        raise PermissionDeniedException("An account with this email already exists.")

    user = User(email=email, password_hash=hash_password(data.password), display_name=data.display_name.strip())
    db_session.add(user)
    await db_session.flush()
    # A new account lands on a board it can use straight away, not an empty state.
    board = Board(user_id=user.id, name="My board")
    db_session.add(board)
    await db_session.flush()
    add_default_columns(db_session, board)
    await db_session.commit()
    request.set_session(session_for(user))
    return user_out(user)


# Checked against when the email is unknown, so a wrong email takes as long to refuse as a wrong
# password - otherwise the time to answer would tell which emails have accounts.
_UNKNOWN_USER_HASH = hash_password("no account has this password")


@post("/login")
async def login(data: LoginRequest, request: Request, db_session: AsyncSession) -> UserOut:
    user = await db_session.scalar(select(User).where(User.email == _normalized_email(data.email)))
    password_hash = _UNKNOWN_USER_HASH if user is None else user.password_hash
    if not verify_password(data.password, password_hash) or user is None:
        raise NotAuthorizedException("Invalid email or password.")
    request.set_session(session_for(user))
    return user_out(user)


@post("/logout")
async def logout(request: Request) -> Response:
    request.clear_session()
    return Response(content=None, status_code=204)


@get("/me")
async def me(request: Request) -> UserOut:
    return user_out(request.user)


auth_router = Router(path="/api/auth", route_handlers=[register, login, logout, me])
