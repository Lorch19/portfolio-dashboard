import sqlite3
from pathlib import Path

from src.config import settings


def get_db_connection(db_path: str) -> sqlite3.Connection:
    """Read-only connection. ?mode=ro enforced at sqlite3 level."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def get_portfolio_db() -> sqlite3.Connection:
    """FastAPI dependency: read-only connection to portfolio.db."""
    path = settings.portfolio_db_path
    if not path or not Path(path).exists():
        raise FileNotFoundError(f"portfolio.db not accessible: {path!r}")
    conn = get_db_connection(path)
    try:
        yield conn
    finally:
        conn.close()


def get_supervisor_db() -> sqlite3.Connection:
    """FastAPI dependency: read-only connection to michael_supervisor.db."""
    path = settings.supervisor_db_path
    if not path or not Path(path).exists():
        raise FileNotFoundError(f"michael_supervisor.db not accessible: {path!r}")
    conn = get_db_connection(path)
    try:
        yield conn
    finally:
        conn.close()
