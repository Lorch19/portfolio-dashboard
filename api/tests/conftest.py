import sqlite3
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.main import app

PORTFOLIO_FUNNEL_SCHEMA = """
CREATE TABLE scout_candidates (
    id INTEGER PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    sector TEXT,
    passed_gates INTEGER NOT NULL DEFAULT 0,
    gate_scores TEXT,
    created_at TEXT
);

CREATE TABLE rejection_log (
    id INTEGER PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    rejection_gate TEXT NOT NULL,
    rejection_reason TEXT NOT NULL,
    created_at TEXT
);

CREATE TABLE guardian_decisions (
    id INTEGER PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    decision TEXT NOT NULL,
    conviction TEXT,
    thesis TEXT,
    created_at TEXT
);

CREATE TABLE trade_events (
    id INTEGER PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL,
    shares REAL,
    price REAL,
    estimated_cost_dollars REAL,
    created_at TEXT
);
"""

PORTFOLIO_FUNNEL_SAMPLE_DATA = """
INSERT INTO scout_candidates (scan_date, ticker, sector, passed_gates, gate_scores, created_at) VALUES
    ('2026-04-04', 'AAPL', 'Technology', 1, '{"momentum": 0.8}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'MSFT', 'Technology', 1, '{"momentum": 0.7}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'GOOGL', 'Technology', 1, '{"momentum": 0.9}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'TSLA', 'Automotive', 1, '{"momentum": 0.6}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'NVDA', 'Technology', 1, '{"momentum": 0.85}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'META', 'Technology', 0, '{"momentum": 0.3}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'AMZN', 'Technology', 0, '{"momentum": 0.2}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'NFLX', 'Entertainment', 0, '{"momentum": 0.1}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'JPM', 'Finance', 1, '{"momentum": 0.5}', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'BAC', 'Finance', 1, '{"momentum": 0.4}', '2026-04-04T06:00:00Z');

INSERT INTO rejection_log (scan_date, ticker, rejection_gate, rejection_reason, created_at) VALUES
    ('2026-04-04', 'META', 'scout', 'low_momentum', '2026-04-04T06:01:00Z'),
    ('2026-04-04', 'AMZN', 'scout', 'volume_insufficient', '2026-04-04T06:01:00Z'),
    ('2026-04-04', 'NFLX', 'scout', 'sector_overweight', '2026-04-04T06:01:00Z');

INSERT INTO guardian_decisions (scan_date, ticker, decision, conviction, thesis, created_at) VALUES
    ('2026-04-04', 'AAPL', 'approve', 'high', 'Strong fundamentals', '2026-04-04T07:00:00Z'),
    ('2026-04-04', 'MSFT', 'approve', 'medium', 'Cloud growth', '2026-04-04T07:00:00Z'),
    ('2026-04-04', 'GOOGL', 'modify', 'medium', 'Reduce position size', '2026-04-04T07:00:00Z'),
    ('2026-04-04', 'TSLA', 'reject', 'low', 'sector_concentration', '2026-04-04T07:00:00Z'),
    ('2026-04-04', 'NVDA', 'approve', 'high', 'AI growth thesis', '2026-04-04T07:00:00Z');

INSERT INTO trade_events (scan_date, ticker, action, shares, price, estimated_cost_dollars, created_at) VALUES
    ('2026-04-04', 'AAPL', 'buy', 10, 185.50, 1855.00, '2026-04-04T08:00:00Z'),
    ('2026-04-04', 'NVDA', 'buy', 5, 890.25, 4451.25, '2026-04-04T08:01:00Z');
"""

PORTFOLIO_HOLDINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS sim_positions (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    sector TEXT,
    entry_price REAL NOT NULL,
    entry_date TEXT NOT NULL,
    current_price REAL NOT NULL,
    shares REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    sleeve INTEGER DEFAULT 1,
    stop_loss REAL,
    target_1 REAL,
    target_2 REAL,
    conviction TEXT DEFAULT 'medium',
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sim_portfolio_snapshots (
    id INTEGER PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    current_stop_level REAL,
    exit_stage TEXT DEFAULT 'initial',
    portfolio_heat_contribution REAL DEFAULT 0.0,
    sector_concentration_status TEXT DEFAULT 'ok',
    created_at TEXT
);
"""

PORTFOLIO_HOLDINGS_SAMPLE_DATA = """
INSERT INTO sim_positions (ticker, sector, entry_price, entry_date, current_price, shares, status, sleeve, stop_loss, target_1, target_2, conviction, created_at) VALUES
    ('AAPL', 'Technology', 175.50, '2026-03-15', 185.50, 10, 'open', 1, 165.00, 195.00, 210.00, 'high', '2026-03-15T09:30:00Z'),
    ('MSFT', 'Technology', 420.00, '2026-03-20', 410.00, 5, 'open', 1, 400.00, 450.00, 480.00, 'medium', '2026-03-20T09:30:00Z'),
    ('NVDA', 'Technology', 890.00, '2026-04-01', 890.00, 3, 'open', 2, 850.00, 950.00, 1000.00, 'high', '2026-04-01T09:30:00Z'),
    ('TSLA', 'Automotive', 250.00, '2026-03-10', 270.00, 8, 'open', 2, 230.00, 280.00, 300.00, 'low', '2026-03-10T09:30:00Z'),
    ('JPM', 'Finance', 200.00, '2026-02-01', 210.00, 15, 'closed', 1, 185.00, 220.00, 240.00, 'medium', '2026-02-01T09:30:00Z');

INSERT INTO sim_portfolio_snapshots (snapshot_date, ticker, current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status, created_at) VALUES
    ('2026-04-04', 'AAPL', 170.00, 'breakeven', 0.12, 'ok', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'MSFT', 405.00, 'initial', 0.08, 'warning', '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'NVDA', 860.00, 'initial', 0.15, 'ok', '2026-04-04T06:00:00Z'),
    ('2026-04-03', 'AAPL', 168.00, 'initial', 0.10, 'ok', '2026-04-03T06:00:00Z');
"""

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
    ('Scout', 'info', '{"message": "Scan complete"}', '2026-04-04T05:30:00Z'),
    ('shadow_observer', 'sync_complete', '{"tables_synced": 5}', '2026-04-04T06:30:00Z'),
    ('shadow_observer', 'health_check', '{"all_ok": true}', '2026-04-04T06:25:00Z'),
    ('shadow_observer', 'drawdown_pause', '{"trigger_pct": 5.2}', '2026-04-04T04:00:00Z'),
    ('Guardian', 'hold_point_triggered', '{"reason": "max drawdown"}', '2026-04-04T03:50:00Z');
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
    """Create a temporary portfolio DB with funnel and holdings schema and sample data."""
    db_file = tmp_path / "portfolio.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(PORTFOLIO_FUNNEL_SCHEMA)
    conn.executescript(PORTFOLIO_FUNNEL_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_HOLDINGS_SCHEMA)
    conn.executescript(PORTFOLIO_HOLDINGS_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient for endpoint tests."""
    return TestClient(app)
