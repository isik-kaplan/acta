from dotenv import load_dotenv
from isik.common.config import boolean, comma_separated_list, config, integer, string


load_dotenv()

settings = config(
    {
        "SECRET_KEY": string(),
        "REGISTRATION_ENABLED": boolean(missing_default=False),
        "DATABASE_PATH": string(missing_default="./data/acta.sqlite3"),
        "SESSION_COOKIE_SECURE": boolean(missing_default=True),
        "CORS_ALLOW_ORIGINS": comma_separated_list(missing_default=[]),
        "VAPID_PRIVATE_KEY": string(missing_default=""),
        "VAPID_PUBLIC_KEY": string(missing_default=""),
        "VAPID_SUBJECT": string(missing_default="mailto:acta@localhost"),
        "REMINDER_INTERVAL_SECONDS": integer(missing_default=60),
    }
)
