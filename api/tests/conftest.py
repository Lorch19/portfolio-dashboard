import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from src.main import app

# ── Real schema: scout_candidates ──────────────────────────────────────

PORTFOLIO_FUNNEL_SCHEMA = """
CREATE TABLE scout_candidates (
    id TEXT PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    sector TEXT,
    regime_at_scan TEXT,
    price_at_scan REAL,
    fundamental_score INTEGER,
    technical_score INTEGER,
    rsi REAL,
    relative_strength REAL,
    volume_ratio REAL,
    was_traded BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'open',
    pe_at_scan REAL,
    median_pe REAL,
    pe_discount_pct REAL,
    roic_at_scan REAL,
    prev_roic REAL,
    roic_delta REAL,
    valuation_verdict TEXT,
    sleeve TEXT,
    created_at TEXT
);

CREATE TABLE rejection_log (
    id TEXT PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    rejected_at_gate TEXT NOT NULL,
    rejection_reason TEXT NOT NULL,
    sector TEXT,
    t_plus_5 REAL,
    t_plus_10 REAL,
    t_plus_20 REAL,
    status TEXT DEFAULT 'open',
    created_at TEXT
);

CREATE TABLE guardian_decisions (
    id TEXT PRIMARY KEY,
    decision_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    decision TEXT NOT NULL,
    proposed_conviction INTEGER,
    proposed_entry REAL,
    proposed_stop REAL,
    rules_triggered TEXT,
    regime_at_decision TEXT,
    portfolio_heat_at_decision REAL,
    sector_concentration_at_decision REAL,
    t_plus_5 REAL,
    t_plus_10 REAL,
    t_plus_20 REAL,
    status TEXT DEFAULT 'open',
    created_at TEXT,
    strategy_id TEXT DEFAULT 'live',
    decided_by_model TEXT
);

CREATE TABLE trade_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ticker TEXT NOT NULL,
    conviction INTEGER,
    entry_price REAL,
    stop_loss REAL,
    target_1 REAL,
    target_2 REAL,
    thesis_full_text TEXT,
    primary_catalyst TEXT,
    invalidation_trigger TEXT,
    decision_tier TEXT,
    exit_price REAL,
    exit_date TEXT,
    exit_trigger TEXT,
    days_held INTEGER,
    pnl_pct REAL,
    estimated_cost_dollars REAL,
    sleeve TEXT,
    created_at TEXT,
    strategy_id TEXT DEFAULT 'live'
);
"""

PORTFOLIO_FUNNEL_SAMPLE_DATA = """
INSERT INTO scout_candidates (id, scan_date, ticker, sector, was_traded, status, fundamental_score, roic_at_scan, prev_roic, roic_delta, rsi, pe_at_scan, median_pe, pe_discount_pct, relative_strength, valuation_verdict, created_at) VALUES
    ('sc1', '2026-04-04', 'AAPL', 'Technology', 1, 'open', 7, 28.5, 25.3, 3.2, 55.4, 28.1, 32.5, -13.5, 1.15, 'undervalued', '2026-04-04T06:00:00Z'),
    ('sc2', '2026-04-04', 'MSFT', 'Technology', 1, 'open', 6, 22.1, 20.8, 1.3, 48.2, 35.0, 33.0, 6.1, 1.08, 'fair_value', '2026-04-04T06:00:00Z'),
    ('sc3', '2026-04-04', 'GOOGL', 'Technology', 0, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z'),
    ('sc4', '2026-04-04', 'TSLA', 'Automotive', 0, 'open', 3, 8.2, 9.1, -0.9, 72.1, 85.0, 50.0, 70.0, 0.92, 'overvalued', '2026-04-04T06:00:00Z'),
    ('sc5', '2026-04-04', 'NVDA', 'Technology', 1, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z'),
    ('sc6', '2026-04-04', 'META', 'Technology', 0, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z'),
    ('sc7', '2026-04-04', 'AMZN', 'Technology', 0, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z'),
    ('sc8', '2026-04-04', 'NFLX', 'Entertainment', 0, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z'),
    ('sc9', '2026-04-04', 'JPM', 'Finance', 0, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z'),
    ('sc10', '2026-04-04', 'BAC', 'Finance', 0, 'open', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-04-04T06:00:00Z');

INSERT INTO rejection_log (id, scan_date, ticker, rejected_at_gate, rejection_reason, t_plus_20, created_at) VALUES
    ('rl1', '2026-04-04', 'META', 'scout', 'low_momentum', NULL, '2026-04-04T06:01:00Z'),
    ('rl2', '2026-04-04', 'AMZN', 'scout', 'volume_insufficient', NULL, '2026-04-04T06:01:00Z'),
    ('rl3', '2026-04-04', 'NFLX', 'scout', 'sector_overweight', NULL, '2026-04-04T06:01:00Z');

INSERT INTO guardian_decisions (id, decision_date, ticker, decision, proposed_conviction, created_at) VALUES
    ('gd1', '2026-04-04', 'AAPL', 'approve', 8, '2026-04-04T07:00:00Z'),
    ('gd2', '2026-04-04', 'MSFT', 'approve', 6, '2026-04-04T07:00:00Z'),
    ('gd3', '2026-04-04', 'GOOGL', 'modify', 5, '2026-04-04T07:00:00Z'),
    ('gd4', '2026-04-04', 'TSLA', 'reject', 3, '2026-04-04T07:00:00Z'),
    ('gd5', '2026-04-04', 'NVDA', 'approve', 7, '2026-04-04T07:00:00Z');

INSERT INTO trade_events (id, timestamp, source, event_type, ticker, entry_price, estimated_cost_dollars, thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, conviction, created_at) VALUES
    ('te1', '2026-04-04T08:00:00Z', 'michael', 'trade_entry', 'AAPL', 185.50, 1.85, 'Strong fundamentals', 'Earnings beat', 'Revenue miss', 'high_conviction', 8, '2026-04-04T08:00:00Z'),
    ('te2', '2026-04-04T08:01:00Z', 'michael', 'trade_entry', 'NVDA', 890.25, 4.45, 'AI growth thesis', 'Data center beat', 'China ban', 'high_conviction', 7, '2026-04-04T08:01:00Z');
"""

# ── Real schema: sim_positions + sim_portfolio_snapshots ───────────────

PORTFOLIO_HOLDINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS sim_positions (
    id TEXT PRIMARY KEY,
    trade_event_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    sector TEXT,
    entry_price REAL NOT NULL,
    entry_date TEXT NOT NULL,
    shares INTEGER NOT NULL,
    stop_loss REAL,
    target_1 REAL,
    target_2 REAL,
    conviction INTEGER,
    sleeve TEXT,
    status TEXT DEFAULT 'open',
    peak_price REAL,
    exit_price REAL,
    exit_date TEXT,
    pnl_pct REAL,
    days_held INTEGER,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS sim_portfolio_snapshots (
    date TEXT NOT NULL,
    strategy_id TEXT NOT NULL DEFAULT 'live',
    total_value REAL,
    cash REAL,
    cash_pct REAL,
    invested_pct REAL,
    positions_count INTEGER,
    portfolio_heat REAL,
    total_trades INTEGER,
    closed_trades INTEGER,
    win_rate REAL,
    total_pnl_pct REAL,
    sp500_return_pct REAL,
    alpha_pct REAL,
    regime TEXT,
    created_at TEXT,
    PRIMARY KEY (date, strategy_id)
);
"""

PORTFOLIO_HOLDINGS_SAMPLE_DATA = """
INSERT INTO sim_positions (id, trade_event_id, ticker, sector, entry_price, entry_date, shares, status, sleeve, stop_loss, target_1, target_2, conviction, peak_price, created_at) VALUES
    ('sp1', 'te1', 'AAPL', 'Technology', 175.50, '2026-03-15', 10, 'open', 'sleeve1', 165.00, 195.00, 210.00, 8, 185.50, '2026-03-15T09:30:00Z'),
    ('sp2', 'te2', 'MSFT', 'Technology', 420.00, '2026-03-20', 5, 'open', 'sleeve1', 400.00, 450.00, 480.00, 6, 410.00, '2026-03-20T09:30:00Z'),
    ('sp3', 'te3', 'NVDA', 'Technology', 890.00, '2026-04-01', 3, 'open', 'sleeve2', 850.00, 950.00, 1000.00, 7, 890.00, '2026-04-01T09:30:00Z'),
    ('sp4', 'te4', 'TSLA', 'Automotive', 250.00, '2026-03-10', 8, 'open', 'sleeve2', 230.00, 280.00, 300.00, 3, 270.00, '2026-03-10T09:30:00Z'),
    ('sp5', 'te5', 'JPM', 'Finance', 200.00, '2026-02-01', 15, 'closed', 'sleeve1', 185.00, 220.00, 240.00, 6, 210.00, '2026-02-01T09:30:00Z');
"""

PORTFOLIO_PERFORMANCE_SAMPLE_DATA = """
INSERT INTO sim_portfolio_snapshots (date, strategy_id, total_value, sp500_return_pct, alpha_pct, total_pnl_pct, total_trades, created_at) VALUES
    ('2026-01-15', 'live', 100000.00, 0.0, 0.0, 0.0, 0, '2026-01-15T06:00:00Z'),
    ('2026-02-15', 'live', 105000.00, 2.08, 2.92, 5.0, 2, '2026-02-15T06:00:00Z'),
    ('2026-03-15', 'live', 108000.00, 3.13, 4.87, 8.0, 4, '2026-03-15T06:00:00Z'),
    ('2026-04-04', 'live', 112500.00, 8.33, 4.17, 12.5, 6, '2026-04-04T06:00:00Z');
"""

# ── Real schema: supervisor tables ─────────────────────────────────────

SUPERVISOR_SCHEMA = """
CREATE TABLE health_checks (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    component TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    strategy_id TEXT DEFAULT 'default',
    payload TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

SUPERVISOR_SAMPLE_DATA = """
INSERT INTO health_checks (timestamp, component, status, details, created_at) VALUES
    ('2026-04-04T06:00:00Z', 'Scout', 'healthy', '{"cycles": 42}', '2026-04-04T06:30:00Z'),
    ('2026-04-04T06:10:00Z', 'Radar', 'healthy', NULL, '2026-04-04T06:30:00Z'),
    ('2026-04-04T06:15:00Z', 'Guardian', 'healthy', NULL, '2026-04-04T06:30:00Z'),
    ('2026-04-04T05:00:00Z', 'Chronicler', 'degraded', '{"error": "timeout"}', '2026-04-04T06:30:00Z'),
    ('2026-04-04T06:20:00Z', 'Michael', 'healthy', NULL, '2026-04-04T06:30:00Z'),
    ('2026-04-04T06:25:00Z', 'Shadow Observer', 'healthy', NULL, '2026-04-04T06:30:00Z');

INSERT INTO events (source, event_type, payload, created_at) VALUES
    ('Guardian', 'alert', '{"message": "High volatility detected"}', '2026-04-04T06:00:00Z'),
    ('Scout', 'info', '{"message": "Scan complete"}', '2026-04-04T05:30:00Z'),
    ('shadow_observer', 'sync_complete', '{"tables_synced": 5}', '2026-04-04T06:30:00Z'),
    ('shadow_observer', 'health_check', '{"all_ok": true}', '2026-04-04T06:25:00Z'),
    ('shadow_observer', 'drawdown_pause', '{"trigger_pct": 5.2}', '2026-04-04T04:00:00Z'),
    ('Guardian', 'hold_point_triggered', '{"reason": "max drawdown"}', '2026-04-04T03:50:00Z');
"""

# ── Supervisor predictions + eval_results (supervisor DB schema) ───────

SUPERVISOR_PERFORMANCE_SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY,
    timestamp TEXT NOT NULL,
    prediction_type TEXT NOT NULL,
    ticker TEXT,
    direction TEXT,
    confidence REAL,
    score REAL,
    strategy_id TEXT DEFAULT 'default',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS eval_results (
    id INTEGER PRIMARY KEY,
    prediction_id INTEGER NOT NULL,
    eval_date TEXT NOT NULL,
    eval_window_days INTEGER NOT NULL,
    actual_return_pct REAL,
    direction_correct INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

SUPERVISOR_PERFORMANCE_SAMPLE_DATA = """
INSERT INTO predictions (timestamp, prediction_type, ticker, direction, confidence, score, created_at) VALUES
    ('2026-03-01T06:00:00Z', 'directional', 'AAPL', 'up', 0.75, 0.0625, '2026-03-01T06:00:00Z'),
    ('2026-03-01T06:00:00Z', 'directional', 'MSFT', 'up', 0.60, 0.36, '2026-03-01T06:00:00Z'),
    ('2026-03-01T06:00:00Z', 'directional', 'GOOGL', 'up', 0.80, 0.04, '2026-03-01T06:00:00Z'),
    ('2026-03-15T06:00:00Z', 'directional', 'NVDA', 'up', 0.55, 0.3025, '2026-03-15T06:00:00Z'),
    ('2026-03-15T06:00:00Z', 'directional', 'TSLA', 'down', 0.70, 0.09, '2026-03-15T06:00:00Z'),
    ('2026-03-15T06:00:00Z', 'directional', 'META', 'up', 0.65, NULL, '2026-03-15T06:00:00Z');

INSERT INTO eval_results (prediction_id, eval_date, eval_window_days, actual_return_pct, direction_correct, created_at) VALUES
    (1, '2026-03-06', 5, 3.5, 1, '2026-03-06T06:00:00Z'),
    (2, '2026-03-11', 10, -2.1, 0, '2026-03-11T06:00:00Z'),
    (3, '2026-03-21', 20, 5.2, 1, '2026-03-21T06:00:00Z'),
    (4, '2026-03-20', 5, -1.8, 0, '2026-03-20T06:00:00Z'),
    (5, '2026-03-25', 10, 4.0, 1, '2026-03-25T06:00:00Z');
"""

# ── Arena tables (in portfolio.db) ─────────────────────────────────────

ARENA_SCHEMA = """
CREATE TABLE IF NOT EXISTS arena_decisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    trigger TEXT NOT NULL,
    decision_count INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS arena_forward_returns (
    id TEXT PRIMARY KEY,
    arena_decision_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    t_plus_5 REAL,
    t_plus_10 REAL,
    t_plus_20 REAL,
    status TEXT DEFAULT 'open',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
"""

ARENA_SAMPLE_DATA = """
INSERT INTO arena_decisions (id, session_id, model_id, provider, trigger, decision_count, cost_usd, created_at) VALUES
    ('ad1', '2026-03-arena-1', 'claude-sonnet', 'anthropic', 'shadow', 3, 1.50, '2026-03-01T06:00:00Z'),
    ('ad2', '2026-03-arena-1', 'gpt-4o', 'openai', 'shadow', 2, 1.60, '2026-03-01T06:00:00Z');

INSERT INTO arena_forward_returns (id, arena_decision_id, session_id, model_id, ticker, decision_type, t_plus_20, created_at) VALUES
    ('afr1', 'ad1', '2026-03-arena-1', 'claude-sonnet', 'AAPL', 'trade', 3.5, '2026-03-21T06:00:00Z'),
    ('afr2', 'ad1', '2026-03-arena-1', 'claude-sonnet', 'MSFT', 'trade', -2.1, '2026-03-21T06:00:00Z'),
    ('afr3', 'ad1', '2026-03-arena-1', 'claude-sonnet', 'GOOGL', 'pass', 5.2, '2026-03-21T06:00:00Z'),
    ('afr4', 'ad2', '2026-03-arena-1', 'gpt-4o', 'AAPL', 'trade', 3.5, '2026-03-21T06:00:00Z'),
    ('afr5', 'ad2', '2026-03-arena-1', 'gpt-4o', 'MSFT', 'exit', -2.1, '2026-03-21T06:00:00Z');
"""

# ── Decisions-specific schemas (extended rejection_log with t_plus_20) ─

PORTFOLIO_DECISIONS_SCHEMA = """
CREATE TABLE IF NOT EXISTS guardian_decisions (
    id TEXT PRIMARY KEY,
    decision_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    decision TEXT NOT NULL,
    proposed_conviction INTEGER,
    rules_triggered TEXT,
    regime_at_decision TEXT,
    portfolio_heat_at_decision REAL,
    sector_concentration_at_decision REAL,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS rejection_log (
    id TEXT PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    rejected_at_gate TEXT NOT NULL,
    rejection_reason TEXT NOT NULL,
    t_plus_20 REAL,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS trade_events (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    ticker TEXT NOT NULL,
    conviction INTEGER,
    entry_price REAL,
    thesis_full_text TEXT,
    primary_catalyst TEXT,
    invalidation_trigger TEXT,
    decision_tier TEXT,
    estimated_cost_dollars REAL,
    created_at TEXT
);

CREATE TABLE IF NOT EXISTS scout_candidates (
    id TEXT PRIMARY KEY,
    scan_date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    fundamental_score INTEGER,
    roic_at_scan REAL,
    prev_roic REAL,
    roic_delta REAL,
    rsi REAL,
    pe_at_scan REAL,
    median_pe REAL,
    pe_discount_pct REAL,
    relative_strength REAL,
    valuation_verdict TEXT,
    created_at TEXT
);
"""

PORTFOLIO_DECISIONS_SAMPLE_DATA = """
INSERT INTO guardian_decisions (id, decision_date, ticker, decision, proposed_conviction, created_at) VALUES
    ('gd1', '2026-04-01', 'AAPL', 'approve', 8, '2026-04-01T07:00:00Z'),
    ('gd2', '2026-04-01', 'MSFT', 'approve', 6, '2026-04-01T07:01:00Z'),
    ('gd3', '2026-04-01', 'TSLA', 'reject', 3, '2026-04-01T07:02:00Z'),
    ('gd4', '2026-03-15', 'AAPL', 'approve', 8, '2026-03-15T07:00:00Z'),
    ('gd5', '2026-03-15', 'NVDA', 'approve', 7, '2026-03-15T07:01:00Z');

INSERT INTO rejection_log (id, scan_date, ticker, rejected_at_gate, rejection_reason, t_plus_20, created_at) VALUES
    ('rl1', '2026-04-01', 'META', 'guardian_valuation', 'P/E too high', 15.2, '2026-04-01T07:05:00Z'),
    ('rl2', '2026-04-01', 'AMZN', 'guardian_fundamentals', 'F-Score below threshold', 12.8, '2026-04-01T07:06:00Z'),
    ('rl3', '2026-04-01', 'NFLX', 'scout', 'low_momentum', -8.3, '2026-04-01T07:07:00Z'),
    ('rl4', '2026-04-01', 'COIN', 'guardian_fundamentals', 'F-Score < 5', -12.1, '2026-04-01T07:08:00Z'),
    ('rl5', '2026-03-15', 'GME', 'scout', 'volume_insufficient', -5.5, '2026-03-15T07:05:00Z');

INSERT INTO trade_events (id, timestamp, source, event_type, ticker, entry_price, thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, conviction, estimated_cost_dollars, created_at) VALUES
    ('te1', '2026-04-01T08:00:00Z', 'michael', 'trade_entry', 'AAPL', 185.50, 'Strong earnings momentum', 'Q2 earnings beat', 'Revenue miss > 5%', 'high_conviction', 8, 1.85, '2026-04-01T08:00:00Z'),
    ('te2', '2026-03-15T08:00:00Z', 'michael', 'trade_entry', 'NVDA', 890.25, 'AI data center demand', 'Data center beat', 'China ban expansion', 'high_conviction', 7, 4.45, '2026-03-15T08:00:00Z');

INSERT INTO scout_candidates (id, scan_date, ticker, fundamental_score, roic_at_scan, prev_roic, roic_delta, rsi, pe_at_scan, median_pe, pe_discount_pct, relative_strength, valuation_verdict, created_at) VALUES
    ('sc1', '2026-04-01', 'AAPL', 7, 28.5, 25.3, 3.2, 55.4, 28.1, 32.5, -13.5, 1.15, 'undervalued', '2026-04-01T06:00:00Z'),
    ('sc2', '2026-04-01', 'MSFT', 6, 22.1, 20.8, 1.3, 48.2, 35.0, 33.0, 6.1, 1.08, 'fair_value', '2026-04-01T06:00:00Z'),
    ('sc3', '2026-03-15', 'NVDA', 7, 35.2, 30.1, 5.1, 60.1, 45.0, 40.0, 12.5, 1.35, 'fair_value', '2026-03-15T06:00:00Z');
"""

REALIZED_GAINS_SCHEMA = """
CREATE TABLE IF NOT EXISTS realized_gains (
    id TEXT PRIMARY KEY,
    trade_event_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    exit_date TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL NOT NULL,
    shares INTEGER NOT NULL,
    gross_pnl REAL NOT NULL,
    transaction_costs REAL DEFAULT 0.0,
    net_pnl REAL NOT NULL,
    holding_period_days INTEGER NOT NULL,
    created_at TEXT
);
"""

REALIZED_GAINS_SAMPLE_DATA = """
INSERT INTO realized_gains (id, trade_event_id, ticker, entry_date, exit_date, entry_price, exit_price, shares, gross_pnl, transaction_costs, net_pnl, holding_period_days, created_at) VALUES
    ('rg1', 'te-jpm', 'JPM', '2026-02-01', '2026-03-01', 200.00, 210.00, 15, 150.00, 4.50, 145.50, 28, '2026-03-01T09:30:00Z'),
    ('rg2', 'te-amzn', 'AMZN', '2026-01-15', '2026-02-15', 180.00, 175.00, 10, -50.00, 3.25, -53.25, 31, '2026-02-15T09:30:00Z');
"""


# ── Fixtures ───────────────────────────────────────────────────────────


@pytest.fixture
def costs_portfolio_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "portfolio_costs.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(PORTFOLIO_FUNNEL_SCHEMA)
    conn.executescript(PORTFOLIO_FUNNEL_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_HOLDINGS_SCHEMA)
    conn.executescript(PORTFOLIO_HOLDINGS_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_PERFORMANCE_SAMPLE_DATA)
    conn.executescript(REALIZED_GAINS_SCHEMA)
    conn.executescript(REALIZED_GAINS_SAMPLE_DATA)
    conn.executescript(ARENA_SCHEMA)
    conn.executescript(ARENA_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def supervisor_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "michael_supervisor.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def portfolio_db_path(tmp_path: Path) -> str:
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
    db_file = tmp_path / "portfolio_perf.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(PORTFOLIO_FUNNEL_SCHEMA)
    conn.executescript(PORTFOLIO_FUNNEL_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_HOLDINGS_SCHEMA)
    conn.executescript(PORTFOLIO_HOLDINGS_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_PERFORMANCE_SAMPLE_DATA)
    conn.executescript(ARENA_SCHEMA)
    conn.executescript(ARENA_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def performance_supervisor_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "supervisor_perf.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SCHEMA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def decisions_portfolio_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "portfolio_decisions.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(PORTFOLIO_DECISIONS_SCHEMA)
    conn.executescript(PORTFOLIO_DECISIONS_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def decisions_supervisor_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "supervisor_decisions.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SCHEMA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
