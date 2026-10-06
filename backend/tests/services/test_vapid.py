import base64
import json
import stat

import pytest
from py_vapid import Vapid02

from app.services import vapid


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


@pytest.fixture(autouse=True)
def fresh_cache():
    vapid.vapid_keys.cache_clear()
    yield
    vapid.vapid_keys.cache_clear()


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(vapid.settings, "DATABASE_PATH", str(tmp_path / "acta.sqlite3"))
    monkeypatch.setattr(vapid.settings, "VAPID_PRIVATE_KEY", "")
    monkeypatch.setattr(vapid.settings, "VAPID_PUBLIC_KEY", "")
    return tmp_path


def test_generated_keys_are_a_matching_p256_pair_in_unpadded_base64url() -> None:
    keys = vapid.generate_keys()
    assert "=" not in keys.private_key + keys.public_key
    public = _decode(keys.public_key)
    assert len(public) == 65
    assert public[0] == 4
    assert len(_decode(keys.private_key)) == 32
    # pywebpush loads the private key exactly like this; its public half must be the one we hand out.
    derived = Vapid02.from_raw(keys.private_key.encode()).public_key.public_numbers()
    assert derived.x.to_bytes(32, "big") + derived.y.to_bytes(32, "big") == public[1:]


def test_b64url_strips_only_the_padding() -> None:
    # "X" is in the base64url alphabet - a key that happens to end in one must keep it.
    assert vapid._b64url(b"\x00\x00\x17") == "AAAX"
    assert vapid._b64url(b"\xff") == "_w"


def test_configured_keys_win(data_dir, monkeypatch) -> None:
    monkeypatch.setattr(vapid.settings, "VAPID_PRIVATE_KEY", "priv")
    monkeypatch.setattr(vapid.settings, "VAPID_PUBLIC_KEY", "pub")
    assert vapid.vapid_keys() == vapid.VapidKeys(private_key="priv", public_key="pub")
    assert not (data_dir / "vapid.json").exists()


def test_half_configured_keys_fall_back_to_the_key_file(data_dir, monkeypatch) -> None:
    monkeypatch.setattr(vapid.settings, "VAPID_PRIVATE_KEY", "priv")
    assert vapid.vapid_keys().private_key != "priv"
    assert (data_dir / "vapid.json").exists()


def test_generated_keys_are_saved_privately_and_reused(data_dir) -> None:
    first = vapid.vapid_keys()
    path = data_dir / "vapid.json"
    assert [each.name for each in data_dir.iterdir()] == ["vapid.json"]
    assert json.loads(path.read_text()) == {"private_key": first.private_key, "public_key": first.public_key}
    assert stat.S_IMODE(path.stat().st_mode) == 0o600

    vapid.vapid_keys.cache_clear()
    assert vapid.vapid_keys() == first


def test_vapid_keys_are_computed_once_per_process(data_dir) -> None:
    assert vapid.vapid_keys() is vapid.vapid_keys()
