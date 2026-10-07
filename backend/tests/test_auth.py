import uuid

import pytest

from app.auth import hash_password, retrieve_user_handler, session_auth, session_backend_config, verify_password
from tests.conftest import register


def test_verify_password_accepts_the_right_password_only() -> None:
    hashed = hash_password("hunter2hunter2")
    assert verify_password("hunter2hunter2", hashed) is True
    assert verify_password("wrong", hashed) is False


def test_verify_password_treats_a_corrupt_hash_as_a_mismatch() -> None:
    assert verify_password("anything", "not-an-argon2-hash") is False


@pytest.mark.parametrize("value", [None, "not-a-uuid", 12345, ["list"]])
async def test_retrieve_user_handler_reads_a_malformed_session_as_logged_out(value) -> None:
    assert await retrieve_user_handler({"user_id": value}, None) is None


async def test_retrieve_user_handler_reads_a_missing_session_as_logged_out() -> None:
    assert await retrieve_user_handler({}, None) is None


async def test_retrieve_user_handler_loads_the_user_by_string_id(client) -> None:
    user = await register(client)
    loaded = await retrieve_user_handler({"user_id": user["id"]}, None)
    assert loaded.email == "ada@acta.local"


async def test_retrieve_user_handler_returns_none_for_an_unknown_id() -> None:
    assert await retrieve_user_handler({"user_id": str(uuid.uuid4())}, None) is None


def test_session_cookie_lasts_thirty_days() -> None:
    assert session_backend_config.max_age == 2_592_000


def test_session_key_is_derived_to_32_bytes() -> None:
    assert len(session_backend_config.secret) == 32


async def test_retrieve_user_handler_refuses_a_session_from_before_a_password_change(client) -> None:
    user = await register(client)
    assert await retrieve_user_handler({"user_id": user["id"], "session_version": 0}, None) is not None
    assert await retrieve_user_handler({"user_id": user["id"], "session_version": 1}, None) is None


async def test_retrieve_user_handler_reads_a_session_without_a_version_as_version_zero(client) -> None:
    user = await register(client)
    assert (await retrieve_user_handler({"user_id": user["id"]}, None)).email == "ada@acta.local"


@pytest.mark.parametrize(
    ("path", "excluded"),
    [
        ("/api/auth/login", True),
        ("/api/auth/register", True),
        ("/health", True),
        ("/schema", True),
        ("/schema/openapi.json", True),
        ("/", True),
        ("/boards/abc", True),
        ("/api/auth/me", False),
        ("/api/auth/login/x", False),
        ("/api/boards", False),
        ("/api/boards/health", False),
        ("/api/x/schema", False),
        ("/api/healthz", False),
        ("/api", False),
        ("/schemas", True),
    ],
)
def test_only_the_public_paths_skip_the_session_check(path, excluded) -> None:
    from litestar.middleware._utils import build_exclude_path_pattern

    pattern = build_exclude_path_pattern(exclude=session_auth.exclude)
    assert bool(pattern.findall(path)) is excluded
