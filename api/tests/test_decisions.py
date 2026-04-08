"""Tests for the decisions API endpoint (Story 6.1)."""


def test_decisions_returns_list(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """AC1: GET /api/decisions returns recent decisions with required fields."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decisions"] is not None
    assert data["decisions_error"] is None
    assert isinstance(data["decisions"], list)
    assert len(data["decisions"]) > 0

    # Check required fields present in each decision
    first = data["decisions"][0]
    for key in ["ticker", "scan_date", "thesis_full_text", "primary_catalyst", "invalidation_trigger", "decision_tier", "conviction"]:
        assert key in first, f"Missing key: {key}"

    # Verify ordered by scan_date DESC
    dates = [d["scan_date"] for d in data["decisions"]]
    assert dates == sorted(dates, reverse=True)


def test_decisions_ticker_filter(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """AC2: GET /api/decisions?ticker=AAPL returns only AAPL decisions with scoring inputs."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions?ticker=AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decisions_error"] is None
    decisions = data["decisions"]

    # All results should be AAPL
    assert len(decisions) >= 2  # sample data has 2 AAPL rows
    for d in decisions:
        assert d["ticker"] == "AAPL"

    # Check scoring inputs present
    first = decisions[0]
    for key in [
        "fundamental_score", "roic_at_scan", "prev_roic", "roic_delta",
        "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
        "relative_strength", "valuation_verdict",
    ]:
        assert key in first, f"Missing scoring key: {key}"
        assert first[key] is not None, f"Scoring key is null: {key}"


def test_decisions_predictions(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """AC3: Response includes prediction outcomes with brier_score."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["predictions"] is not None
    assert data["predictions_error"] is None
    assert isinstance(data["predictions"], list)
    assert len(data["predictions"]) > 0

    # Check prediction fields
    first = data["predictions"][0]
    for key in ["ticker", "scan_date", "predicted_outcome", "probability", "actual_outcome", "resolved", "brier_score"]:
        assert key in first, f"Missing prediction key: {key}"

    # Check predictions with brier_score (score) are present
    with_score = [p for p in data["predictions"] if p["brier_score"] is not None]
    assert len(with_score) > 0


def test_decisions_counterfactuals(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """AC4: Response includes counterfactuals with top_misses and top_good_rejections."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["counterfactuals"] is not None
    assert data["counterfactuals_error"] is None

    cf = data["counterfactuals"]
    assert "top_misses" in cf
    assert "top_good_rejections" in cf

    # Top misses: forward_return_pct > 10%
    assert len(cf["top_misses"]) > 0
    for miss in cf["top_misses"]:
        assert miss["forward_return_pct"] > 10.0
        for key in ["ticker", "scan_date", "rejection_gate", "rejection_reason"]:
            assert key in miss

    # Top good rejections: forward_return_pct < 0%
    assert len(cf["top_good_rejections"]) > 0
    for good in cf["top_good_rejections"]:
        assert good["forward_return_pct"] < 0.0


def test_decisions_portfolio_db_unavailable(client, decisions_supervisor_db_path, monkeypatch):
    """Portfolio DB unavailable: decisions and counterfactuals error, predictions still works."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", "")
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()

    # Portfolio sections should have errors
    assert data["decisions"] is None
    assert data["decisions_error"] is not None
    assert data["counterfactuals"] is None
    assert data["counterfactuals_error"] is not None

    # Supervisor section should still work
    assert data["predictions"] is not None
    assert data["predictions_error"] is None


def test_decisions_supervisor_db_unavailable(client, decisions_portfolio_db_path, monkeypatch):
    """Supervisor DB unavailable: predictions error, decisions and counterfactuals still work."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", "")
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()

    # Portfolio sections should still work
    assert data["decisions"] is not None
    assert data["decisions_error"] is None
    assert data["counterfactuals"] is not None
    assert data["counterfactuals_error"] is None

    # Supervisor section should have error
    assert data["predictions"] is None
    assert data["predictions_error"] is not None


def test_decisions_empty_tables(client, tmp_path, monkeypatch):
    """Empty tables: all sections return empty lists/null gracefully."""
    import sqlite3

    # Create empty DBs with schemas but no data
    portfolio_db = tmp_path / "empty_portfolio.db"
    conn = sqlite3.connect(str(portfolio_db))
    conn.executescript("""
        CREATE TABLE guardian_decisions (
            id TEXT PRIMARY KEY, decision_date TEXT, ticker TEXT, decision TEXT,
            proposed_conviction INTEGER, created_at TEXT
        );
        CREATE TABLE rejection_log (
            id TEXT PRIMARY KEY, scan_date TEXT, ticker TEXT,
            rejected_at_gate TEXT, rejection_reason TEXT, t_plus_20 REAL,
            created_at TEXT
        );
        CREATE TABLE trade_events (
            id TEXT PRIMARY KEY, timestamp TEXT, source TEXT, event_type TEXT,
            ticker TEXT, thesis_full_text TEXT, primary_catalyst TEXT,
            invalidation_trigger TEXT, decision_tier TEXT, conviction INTEGER,
            entry_price REAL, estimated_cost_dollars REAL, created_at TEXT
        );
        CREATE TABLE scout_candidates (
            id TEXT PRIMARY KEY, scan_date TEXT, ticker TEXT,
            fundamental_score INTEGER, created_at TEXT
        );
    """)
    conn.close()

    supervisor_db = tmp_path / "empty_supervisor.db"
    conn = sqlite3.connect(str(supervisor_db))
    conn.executescript("""
        CREATE TABLE predictions (
            id INTEGER PRIMARY KEY, timestamp TEXT, prediction_type TEXT,
            ticker TEXT, direction TEXT, confidence REAL, score REAL,
            strategy_id TEXT DEFAULT 'default', created_at TEXT
        );
    """)
    conn.close()

    monkeypatch.setattr("src.config.settings.portfolio_db_path", str(portfolio_db))
    monkeypatch.setattr("src.config.settings.supervisor_db_path", str(supervisor_db))
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()

    assert data["decisions"] == []
    assert data["decisions_error"] is None
    assert data["counterfactuals"]["top_misses"] == []
    assert data["counterfactuals"]["top_good_rejections"] == []
    assert data["counterfactuals_error"] is None
    assert data["predictions"] == []
    assert data["predictions_error"] is None


def test_decisions_unknown_ticker(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """Unknown ticker returns empty decisions list, not 404."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions?ticker=ZZZZZ")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decisions"] == []
    assert data["decisions_error"] is None
    assert data["predictions"] == []
    assert data["predictions_error"] is None


# ── Enrichment tests ─────────────────────────────────────────────────────


def test_decisions_enriched_fields(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """Enriched fields from trade_events and scout_candidates are included."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions?ticker=AAPL")
    assert resp.status_code == 200
    data = resp.json()
    decisions = data["decisions"]
    assert len(decisions) >= 1

    # Find the AAPL guardian_decisions entry (enriched via scout_candidates)
    aapl = decisions[0]

    # Scout enrichment fields should be populated
    assert aapl["insider_signal"] == "buy"
    assert aapl["insider_net_value_usd"] == 2500000
    assert aapl["insider_buy_cluster"] == 1
    assert aapl["michael_quality_score"] == 8.2
    assert aapl["beneish_m_score"] == -2.1
    assert aapl["altman_z_score"] == 4.5
    assert aapl["sector"] == "Technology"
    assert aapl["technical_score"] == 8


def test_decisions_enriched_trade_events_fields(client, tmp_path, monkeypatch):
    """When using trade_events fallback, enrichment columns are included."""
    import sqlite3
    from tests.conftest import PORTFOLIO_DECISIONS_SCHEMA, PORTFOLIO_DECISIONS_SAMPLE_DATA
    from tests.conftest import SUPERVISOR_PERFORMANCE_SCHEMA, SUPERVISOR_PERFORMANCE_SAMPLE_DATA
    from tests.conftest import SUPERVISOR_SCHEMA, SUPERVISOR_SAMPLE_DATA

    # Create portfolio DB with empty guardian_decisions to force trade_events fallback
    portfolio_db = tmp_path / "portfolio_te.db"
    conn = sqlite3.connect(str(portfolio_db))
    conn.executescript(PORTFOLIO_DECISIONS_SCHEMA)
    # Insert only trade_events and scout_candidates, skip guardian_decisions
    conn.executescript("""
INSERT INTO trade_events (id, timestamp, source, event_type, ticker, entry_price, thesis_full_text, primary_catalyst, invalidation_trigger, decision_tier, conviction, estimated_cost_dollars, bear_case_text, pre_mortem_text, moat_thesis, critique_quality_score, critique_changed_decision, challenge_gate_result, decided_by_model, pnl_pct, realized_rr, max_favorable_excursion_pct, days_held, sp500_return_same_period, exit_price, exit_date, exit_trigger, exit_reason, sleeve, stop_loss, target_1, target_2, created_at) VALUES
    ('te1', '2026-04-01T08:00:00Z', 'michael', 'trade_entry', 'AAPL', 185.50, 'Strong earnings', 'Q2 beat', 'Revenue miss', 'high_conviction', 8, 1.85, 'iPhone saturation', 'Services stall', 'Ecosystem lock-in', 7.5, 0, 'passed', 'claude-sonnet-4', 5.2, 1.8, 8.1, 22, 2.1, 195.14, '2026-04-23', 'target_1_hit', 'Price reached target', 'core', 175.00, 195.00, 210.00, '2026-04-01T08:00:00Z');
INSERT INTO scout_candidates (id, scan_date, ticker, fundamental_score, technical_score, roic_at_scan, prev_roic, roic_delta, rsi, pe_at_scan, median_pe, pe_discount_pct, relative_strength, valuation_verdict, michael_quality_score, beneish_m_score, altman_z_score, insider_signal, insider_net_value_usd, insider_buy_cluster, momentum_at_scan, sector, price_at_scan, created_at) VALUES
    ('sc1', '2026-04-01', 'AAPL', 7, 8, 28.5, 25.3, 3.2, 55.4, 28.1, 32.5, -13.5, 1.15, 'undervalued', 8.2, -2.1, 4.5, 'buy', 2500000, 1, 12.3, 'Technology', 185.50, '2026-04-01T06:00:00Z');
    """)
    conn.close()

    supervisor_db = tmp_path / "supervisor_te.db"
    conn = sqlite3.connect(str(supervisor_db))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SCHEMA)
    conn.executescript(SUPERVISOR_PERFORMANCE_SAMPLE_DATA)
    conn.close()

    monkeypatch.setattr("src.config.settings.portfolio_db_path", str(portfolio_db))
    monkeypatch.setattr("src.config.settings.supervisor_db_path", str(supervisor_db))
    resp = client.get("/api/decisions?ticker=AAPL")
    assert resp.status_code == 200
    aapl = resp.json()["decisions"][0]

    # Trade events enrichment fields
    assert aapl["bear_case_text"] == "iPhone saturation"
    assert aapl["pre_mortem_text"] == "Services stall"
    assert aapl["moat_thesis"] == "Ecosystem lock-in"
    assert aapl["critique_quality_score"] == 7.5
    assert aapl["critique_changed_decision"] == 0
    assert aapl["challenge_gate_result"] == "passed"
    assert aapl["decided_by_model"] == "claude-sonnet-4"
    assert aapl["pnl_pct"] == 5.2
    assert aapl["realized_rr"] == 1.8
    assert aapl["max_favorable_excursion_pct"] == 8.1
    assert aapl["days_held"] == 22
    assert aapl["sp500_return_same_period"] == 2.1
    assert aapl["exit_trigger"] == "target_1_hit"
    assert aapl["exit_reason"] == "Price reached target"
    assert aapl["sleeve"] == "core"

    # Scout enrichment overlay
    assert aapl["insider_signal"] == "buy"
    assert aapl["michael_quality_score"] == 8.2


def test_decisions_graceful_degradation_missing_columns(client, tmp_path, monkeypatch):
    """Minimal schema without enrichment columns still returns valid data."""
    import sqlite3

    portfolio_db = tmp_path / "portfolio_minimal.db"
    conn = sqlite3.connect(str(portfolio_db))
    conn.executescript("""
        CREATE TABLE guardian_decisions (
            id TEXT PRIMARY KEY, decision_date TEXT, ticker TEXT, decision TEXT,
            proposed_conviction INTEGER, created_at TEXT
        );
        CREATE TABLE rejection_log (
            id TEXT PRIMARY KEY, scan_date TEXT, ticker TEXT,
            rejected_at_gate TEXT, rejection_reason TEXT, t_plus_20 REAL,
            created_at TEXT
        );
        CREATE TABLE trade_events (
            id TEXT PRIMARY KEY, timestamp TEXT, source TEXT, event_type TEXT,
            ticker TEXT, conviction INTEGER, thesis_full_text TEXT,
            primary_catalyst TEXT, invalidation_trigger TEXT, decision_tier TEXT,
            entry_price REAL, created_at TEXT
        );
        CREATE TABLE scout_candidates (
            id TEXT PRIMARY KEY, scan_date TEXT, ticker TEXT,
            fundamental_score INTEGER, created_at TEXT
        );
        INSERT INTO trade_events VALUES ('te1', '2026-04-01T08:00:00Z', 'michael', 'trade_entry', 'AAPL', 8, 'Thesis', 'Catalyst', 'Invalidation', 'high', 185.50, '2026-04-01T08:00:00Z');
    """)
    conn.close()

    monkeypatch.setattr("src.config.settings.portfolio_db_path", str(portfolio_db))
    monkeypatch.setattr("src.config.settings.supervisor_db_path", "")
    resp = client.get("/api/decisions")
    assert resp.status_code == 200
    data = resp.json()
    decisions = data["decisions"]
    assert len(decisions) == 1

    aapl = decisions[0]
    assert aapl["ticker"] == "AAPL"
    assert aapl["thesis_full_text"] == "Thesis"
    # Enrichment fields should be absent (not in all_keys since columns don't exist)
    assert aapl.get("bear_case_text") is None
    assert aapl.get("pnl_pct") is None
    assert aapl.get("insider_signal") is None


# ── Ticker deep-dive tests ───────────────────────────────────────────────


def test_ticker_deep_dive_endpoint(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """GET /api/decisions/{ticker} returns decisions, scoring history, rejection history, predictions."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions/AAPL")
    assert resp.status_code == 200
    data = resp.json()

    assert data["error"] is None
    assert data["predictions_error"] is None

    # Decisions
    assert isinstance(data["decisions"], list)
    assert len(data["decisions"]) >= 1

    # Scoring history — AAPL has 2 scout_candidates entries (2026-04-01, 2026-03-15)
    assert isinstance(data["scoring_history"], list)
    assert len(data["scoring_history"]) >= 2
    for entry in data["scoring_history"]:
        assert entry["ticker"] == "AAPL"
    # Ordered by scan_date DESC
    dates = [e["scan_date"] for e in data["scoring_history"]]
    assert dates == sorted(dates, reverse=True)

    # Rejection history — AAPL has 1 rejection entry
    assert isinstance(data["rejection_history"], list)
    assert len(data["rejection_history"]) >= 1
    for entry in data["rejection_history"]:
        assert entry["ticker"] == "AAPL"

    # Predictions
    assert isinstance(data["predictions"], list)


def test_ticker_deep_dive_unknown_ticker(client, decisions_portfolio_db_path, decisions_supervisor_db_path, monkeypatch):
    """Unknown ticker returns 200 with empty lists, not 404."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", decisions_portfolio_db_path)
    monkeypatch.setattr("src.config.settings.supervisor_db_path", decisions_supervisor_db_path)
    resp = client.get("/api/decisions/ZZZZZ")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decisions"] == []
    assert data["scoring_history"] == []
    assert data["rejection_history"] == []
    assert data["error"] is None


def test_ticker_deep_dive_db_unavailable(client, monkeypatch):
    """Portfolio DB not configured returns error string."""
    monkeypatch.setattr("src.config.settings.portfolio_db_path", "")
    monkeypatch.setattr("src.config.settings.supervisor_db_path", "")
    resp = client.get("/api/decisions/AAPL")
    assert resp.status_code == 200
    data = resp.json()
    assert data["decisions"] is None
    assert data["error"] is not None
    assert "not configured" in data["error"]
