import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.main import app

SUPERVISOR_SCHEMA = """
CREATE TABLE health_checks (
    id INTEGER PRIMARY KEY,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL,
    last_run TEXT,
    details TEXT,
    checked_at TEXT NOT NULL
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    data TEXT,
    created_at TEXT NOT NULL
);
"""

SUPERVISOR_SAMPLE_DATA = """
INSERT INTO health_checks (agent_name, status, last_run, details, checked_at) VALUES
    ('Scout', 'healthy', '2026-04-04T06:00:00Z', '{"cycles": 42}', '2026-04-04T06:30:00Z'),
    ('Radar', 'healthy', '2026-04-04T06:10:00Z', NULL, '2026-04-04T06:30:00Z'),
    ('Guardian', 'healthy', '2026-04-04T06:15:00Z', NULL, '2026-04-04T06:30:00Z'),
    ('Chronicler', 'degraded', '2026-04-04T05:00:00Z', '{"error": "timeout"}', '2026-04-04T06:30:00Z'),
    ('Michael', 'healthy', '2026-04-04T06:20:00Z', NULL, '2026-04-04T06:30:00Z'),
    ('Shadow Observer', 'healthy', '2026-04-04T06:25:00Z', NULL, '2026-04-04T06:30:00Z');

INSERT INTO events (source, event_type, data, created_at) VALUES
    ('Guardian', 'alert', '{"message": "High volatility detected"}', '2026-04-04T06:00:00Z'),
    ('Scout', 'info', '{"message": "Scan complete"}', '2026-04-04T05:30:00Z');
"""


@pytest.fixture
def supervisor_db_path(tmp_path: Path) -> str:
    """Create a temporary supervisor DB with schema and sample data."""
    db_file = tmp_path / "michael_supervisor.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def portfolio_db_path(tmp_path: Path) -> str:
    """Create a temporary empty portfolio DB."""
    db_file = tmp_path / "portfolio.db"
    conn = sqlite3.connect(str(db_file))
    conn.execute("CREATE TABLE _placeholder (id INTEGER PRIMARY KEY)")
    conn.close()
    return str(db_file)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient for endpoint tests."""
    return TestClient(app)
