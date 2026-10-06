from datetime import UTC

from app.models import utcnow


def test_utcnow_is_zone_aware_utc() -> None:
    assert utcnow().tzinfo is UTC
