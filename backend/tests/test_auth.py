import uuid

import pytest

from app.auth import hash_password, retrieve_user_handler, session_backend_config, verify_password
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
