from urllib.parse import urlsplit

from litestar import Request
from litestar.exceptions import PermissionDeniedException

from app.config import settings


SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def is_cross_site(headers) -> bool:
    """Whether a browser sent this request from some other site's page.

    The session cookie is SameSite=Lax, which already keeps it off requests from other sites - but
    not off ones from a sibling subdomain, which count as the same "site". Fetch metadata names the
    exact relation, and every current browser sends it; Origin is the fallback for one that
    doesn't. A request with neither didn't come from a page at all (curl, a script), and a forged
    cross-site request can't strip both."""
    origin = headers.get("origin")
    if origin in settings.CORS_ALLOW_ORIGINS:
        return False
    fetch_site = headers.get("sec-fetch-site")
    if fetch_site is not None:
        # "none" is the user's own doing - typing the URL, a bookmark.
        return fetch_site not in ("same-origin", "none")
    if origin is None:
        return False
    return urlsplit(origin).netloc != headers.get("host")


async def refuse_cross_site_writes(request: Request) -> None:
    if request.method in SAFE_METHODS:
        return
    if is_cross_site(request.headers):
        raise PermissionDeniedException("Cross-site request refused.")
