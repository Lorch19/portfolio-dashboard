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
    portfolio_value REAL,
    spy_value REAL,
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

INSERT INTO sim_portfolio_snapshots (snapshot_date, ticker, current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status, portfolio_value, spy_value, created_at) VALUES
    ('2026-04-04', 'AAPL', 170.00, 'breakeven', 0.12, 'ok', NULL, NULL, '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'MSFT', 405.00, 'initial', 0.08, 'warning', NULL, NULL, '2026-04-04T06:00:00Z'),
    ('2026-04-04', 'NVDA', 860.00, 'initial', 0.15, 'ok', NULL, NULL, '2026-04-04T06:00:00Z'),
    ('2026-04-03', 'AAPL', 168.00, 'initial', 0.10, 'ok', NULL, NULL, '2026-04-03T06:00:00Z');
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


PORTFOLIO_PERFORMANCE_SCHEMA = """
CREATE TABLE IF NOT EXISTS sim_portfolio_snapshots_perf (
    id INTEGER PRIMARY KEY,
    snapshot_date TEXT NOT NULL,
    portfolio_value REAL,
    spy_value REAL,
    created_at TEXT
);
"""

PORTFOLIO_PERFORMANCE_SAMPLE_DATA = """
INSERT INTO sim_portfolio_snapshots (snapshot_date, ticker, current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status, portfolio_value, spy_value, created_at) VALUES
    ('2026-01-15', '_PORTFOLIO', NULL, NULL, NULL, NULL, 100000.00, 4800.00, '2026-01-15T06:00:00Z'),
    ('2026-02-15', '_PORTFOLIO', NULL, NULL, NULL, NULL, 105000.00, 4900.00, '2026-02-15T06:00:00Z'),
    ('2026-03-15', '_PORTFOLIO', NULL, NULL, NULL, NULL, 108000.00, 4950.00, '2026-03-15T06:00:00Z'),
    ('2026-04-04', '_PORTFOLIO', NULL, NULL, NULL, NULL, 112500.00, 5200.00, '2026-04-04T06:00:00Z');
"""

SUPERVISOR_PERFORMANCE_SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY,
    ticker TEXT NOT NULL,
    scan_date TEXT NOT NULL,
    predicted_outcome TEXT,
    probability REAL,
    eval_window TEXT,
    resolved INTEGER DEFAULT 0,
    actual_outcome TEXT,
    brier_score REAL,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS eval_results (
    id INTEGER PRIMARY KEY,
    prediction_id INTEGER,
    eval_window TEXT NOT NULL,
    hit INTEGER NOT NULL DEFAULT 0,
    forward_return REAL,
    evaluated_at TEXT
);

CREATE TABLE IF NOT EXISTS arena_decisions (
    id INTEGER PRIMARY KEY,
    session_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    scan_date TEXT NOT NULL,
    decision TEXT NOT NULL,
    cost_usd REAL DEFAULT 0.0,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS arena_forward_returns (
    id INTEGER PRIMARY KEY,
    arena_decision_id INTEGER NOT NULL,
    forward_return REAL,
    evaluated_at TEXT
);
"""

SUPERVISOR_PERFORMANCE_SAMPLE_DATA = """
INSERT INTO predictions (ticker, scan_date, predicted_outcome, probability, eval_window, resolved, actual_outcome, brier_score, created_at) VALUES
    ('AAPL', '2026-03-01', 'up', 0.75, 'T+5', 1, 'up', 0.0625, '2026-03-01T06:00:00Z'),
    ('MSFT', '2026-03-01', 'up', 0.60, 'T+10', 1, 'down', 0.36, '2026-03-01T06:00:00Z'),
    ('GOOGL', '2026-03-01', 'up', 0.80, 'T+20', 1, 'up', 0.04, '2026-03-01T06:00:00Z'),
    ('NVDA', '2026-03-15', 'up', 0.55, 'T+5', 1, 'down', 0.3025, '2026-03-15T06:00:00Z'),
    ('TSLA', '2026-03-15', 'down', 0.70, 'T+10', 1, 'down', 0.09, '2026-03-15T06:00:00Z'),
    ('META', '2026-03-15', 'up', 0.65, 'T+20', 0, NULL, NULL, '2026-03-15T06:00:00Z');

INSERT INTO eval_results (prediction_id, eval_window, hit, forward_return, evaluated_at) VALUES
    (1, 'T+5', 1, 3.5, '2026-03-06T06:00:00Z'),
    (2, 'T+10', 0, -2.1, '2026-03-11T06:00:00Z'),
    (3, 'T+20', 1, 5.2, '2026-03-21T06:00:00Z'),
    (4, 'T+5', 0, -1.8, '2026-03-20T06:00:00Z'),
    (5, 'T+10', 1, 4.0, '2026-03-25T06:00:00Z');

INSERT INTO arena_decisions (session_id, model_id, ticker, scan_date, decision, cost_usd, created_at) VALUES
    ('2026-03-arena-1', 'claude-sonnet', 'AAPL', '2026-03-01', 'buy', 0.50, '2026-03-01T06:00:00Z'),
    ('2026-03-arena-1', 'claude-sonnet', 'MSFT', '2026-03-01', 'buy', 0.50, '2026-03-01T06:00:00Z'),
    ('2026-03-arena-1', 'claude-sonnet', 'GOOGL', '2026-03-01', 'hold', 0.50, '2026-03-01T06:00:00Z'),
    ('2026-03-arena-1', 'gpt-4o', 'AAPL', '2026-03-01', 'buy', 0.80, '2026-03-01T06:00:00Z'),
    ('2026-03-arena-1', 'gpt-4o', 'MSFT', '2026-03-01', 'sell', 0.80, '2026-03-01T06:00:00Z');

INSERT INTO arena_forward_returns (arena_decision_id, forward_return, evaluated_at) VALUES
    (1, 3.5, '2026-03-21T06:00:00Z'),
    (2, -2.1, '2026-03-21T06:00:00Z'),
    (3, 5.2, '2026-03-21T06:00:00Z'),
    (4, 3.5, '2026-03-21T06:00:00Z'),
    (5, -2.1, '2026-03-21T06:00:00Z');
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
def performance_portfolio_db_path(tmp_path: Path) -> str:
    """Create a temporary portfolio DB with all schemas including performance data."""
    db_file = tmp_path / "portfolio_perf.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(PORTFOLIO_FUNNEL_SCHEMA)
    conn.executescript(PORTFOLIO_FUNNEL_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_HOLDINGS_SCHEMA)
    conn.executescript(PORTFOLIO_HOLDINGS_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_PERFORMANCE_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def performance_supervisor_db_path(tmp_path: Path) -> str:
    """Create a temporary supervisor DB with all schemas including performance data."""
    db_file = tmp_path / "supervisor_perf.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SCHEMA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient for endpoint tests."""
    return TestClient(app)
