import logging
import os

_LOGGER_CONFIGURED = False

_LEVEL_MAP = {
    "CRITICAL": logging.CRITICAL,
    "ERROR": logging.ERROR,
    "WARNING": logging.WARNING,
    "INFO": logging.INFO,
    "DEBUG": logging.DEBUG,
    "NOTSET": logging.NOTSET,
}


def _resolve_log_level() -> int:
    env_level = os.getenv("LOG_LEVEL", "INFO").upper()
    return _LEVEL_MAP.get(env_level, logging.INFO)


def get_logger(name: str | None = None) -> logging.Logger:
    """Return a configured logger shared across the project."""
    global _LOGGER_CONFIGURED
    if not _LOGGER_CONFIGURED:
        logging.basicConfig(
            level=_resolve_log_level(),
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        )
        _LOGGER_CONFIGURED = True

    return logging.getLogger(name or "app")
