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
    assert data["counterfactuals"] == {"top_misses": [], "top_good_rejections": []}
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
