import base64
import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.config import settings


@dataclass(frozen=True)
class VapidKeys:
    # Both unpadded base64url, the form browsers (applicationServerKey) and pywebpush expect.
    private_key: str
    public_key: str


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def generate_keys() -> VapidKeys:
    private = ec.generate_private_key(ec.SECP256R1())
    return VapidKeys(
        private_key=_b64url(private.private_numbers().private_value.to_bytes(32)),
        public_key=_b64url(
            private.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
        ),
    )


def _key_file() -> Path:
    return Path(settings.DATABASE_PATH).parent / "vapid.json"


@cache
def vapid_keys() -> VapidKeys:
    """The configured pair, or one generated once and kept beside the database. Every browser
    subscription is bound to the public key it was made with, so it has to outlive restarts and
    redeploys - which the data volume does, and a key regenerated per boot wouldn't."""
    if settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY:
        return VapidKeys(private_key=settings.VAPID_PRIVATE_KEY, public_key=settings.VAPID_PUBLIC_KEY)
    path = _key_file()
    if path.exists():
        return VapidKeys(**json.loads(path.read_text()))
    keys = generate_keys()
    path.write_text(json.dumps({"private_key": keys.private_key, "public_key": keys.public_key}))
    path.chmod(0o600)
    return keys
