import hashlib
from uuid import UUID

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from litestar.connection import ASGIConnection
from litestar.middleware.session.client_side import CookieBackendConfig
from litestar.security.session_auth import SessionAuth

from app.config import settings
from app.db import session_factory
from app.models import User


_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    # InvalidHashError - a corrupted or foreign-format hash - is a ValueError, not part of
    # VerifyMismatchError's hierarchy; both mean "this password doesn't verify", not a 500.
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def session_for(user: User) -> dict:
    return {"user_id": str(user.id), "session_version": user.session_version}


async def retrieve_user_handler(session: dict, connection: ASGIConnection) -> User | None:
    # The session cookie round-trips through JSON, which has no UUID type - the id comes back as a
    # string, and a malformed one must read as "not logged in", not a 500.
    try:
        user_id = UUID(session.get("user_id"))
    except (ValueError, TypeError, AttributeError):
        return None
    async with session_factory() as db_session:
        user = await db_session.get(User, user_id)
    # A cookie from before the last password change no longer counts. One from before sessions
    # carried a version at all reads as version 0, so existing logins survive the upgrade.
    if user is None or session.get("session_version", 0) != user.session_version:
        return None
    return user


# CookieBackendConfig encrypts the session with AES, which needs a 16/24/32-byte key - hashing
# SECRET_KEY down to 32 bytes makes any non-empty SECRET_KEY work, whatever its length.
session_backend_config = CookieBackendConfig(
    secret=hashlib.sha256(settings.SECRET_KEY.encode()).digest(),
    secure=settings.SESSION_COOKIE_SECURE,
    # A personal tool you open from your home screen every day - logging in once a month is plenty.
    max_age=60 * 60 * 24 * 30,
)

session_auth = SessionAuth[User, CookieBackendConfig](
    retrieve_user_handler=retrieve_user_handler,
    session_backend_config=session_backend_config,
    # Anchored: Litestar searches each pattern anywhere in the path, so an unanchored "/health"
    # would also let through any path that merely contains it.
    exclude=[r"^/api/auth/(register|login)$", r"^/health$", r"^/schema(/|$)", r"^/(?!api(/|$))"],
)
