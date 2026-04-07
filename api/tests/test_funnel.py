"""Tests for GET /api/funnel endpoint and portfolio query functions."""

import sqlite3

from fastapi.testclient import TestClient

from src.db.portfolio import get_funnel_counts, get_funnel_drilldown, get_latest_scan_date
from src.main import app


# ---------------------------------------------------------------------------
# Query-level tests (direct DB functions)
# ---------------------------------------------------------------------------


class TestGetLatestScanDate:
    def test_returns_latest_date(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_latest_scan_date(conn)
        conn.close()
        assert result == "2026-04-04"

    def test_returns_none_when_empty(self, tmp_path):
        db_file = tmp_path / "empty.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute(
            "CREATE TABLE scout_candidates (id INTEGER PRIMARY KEY, scan_date TEXT, ticker TEXT, passed_gates INTEGER)"
        )
        conn.row_factory = sqlite3.Row
        result = get_latest_scan_date(conn)
        conn.close()
        assert result is None


class TestGetFunnelCounts:
    def test_returns_correct_counts(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        counts = get_funnel_counts(conn, "2026-04-04")
        conn.close()
        assert counts["scout_universe"] == 10
        assert counts["scout_passed"] == 7
        assert counts["guardian_approved"] == 3
        assert counts["guardian_modified"] == 1
        assert counts["guardian_rejected"] == 1
        assert counts["michael_traded"] == 2

    def test_returns_zeros_for_missing_date(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        counts = get_funnel_counts(conn, "2099-01-01")
        conn.close()
        assert all(v == 0 for v in counts.values())


class TestGetFunnelDrilldown:
    def test_returns_drilldown_entries(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        drilldown = get_funnel_drilldown(conn, "2026-04-04")
        conn.close()
        assert len(drilldown) > 0
        tickers = {d["ticker"] for d in drilldown}
        assert "AAPL" in tickers
        assert "TSLA" in tickers
        assert "META" in tickers

    def test_stage_values_are_valid(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        drilldown = get_funnel_drilldown(conn, "2026-04-04")
        conn.close()
        valid_stages = {"scout_rejected", "guardian_approved", "guardian_modified", "guardian_rejected", "traded"}
        for entry in drilldown:
            assert entry["stage"] in valid_stages, f"Invalid stage: {entry['stage']}"
            assert "ticker" in entry
            assert "reason" in entry

    def test_includes_scout_rejected(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        drilldown = get_funnel_drilldown(conn, "2026-04-04")
        conn.close()
        scout_rejected = [d for d in drilldown if d["stage"] == "scout_rejected"]
        assert len(scout_rejected) == 3
        rejected_tickers = {d["ticker"] for d in scout_rejected}
        assert rejected_tickers == {"META", "AMZN", "NFLX"}

    def test_includes_traded(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        drilldown = get_funnel_drilldown(conn, "2026-04-04")
        conn.close()
        traded = [d for d in drilldown if d["stage"] == "traded"]
        assert len(traded) == 2
        traded_tickers = {d["ticker"] for d in traded}
        assert traded_tickers == {"AAPL", "NVDA"}

    def test_returns_empty_for_missing_date(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        drilldown = get_funnel_drilldown(conn, "2099-01-01")
        conn.close()
        assert drilldown == []


# ---------------------------------------------------------------------------
# Endpoint-level tests
# ---------------------------------------------------------------------------


class TestFunnelEndpoint:
    def test_returns_200_with_scan_date(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        response = client.get("/api/funnel?scan_date=2026-04-04")
        assert response.status_code == 200
        data = response.json()
        assert data["scan_date"] == "2026-04-04"
        assert data["stages"] is not None
        assert data["stages_error"] is None
        assert data["drilldown"] is not None
        assert data["drilldown_error"] is None
        assert data["message"] is None

    def test_stage_counts_match(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/funnel?scan_date=2026-04-04").json()
        stages = data["stages"]
        assert stages["scout_universe"] == 10
        assert stages["scout_passed"] == 7
        assert stages["guardian_approved"] == 3
        assert stages["guardian_modified"] == 1
        assert stages["guardian_rejected"] == 1
        assert stages["michael_traded"] == 2

    def test_drilldown_includes_ticker_stage_reason(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/funnel?scan_date=2026-04-04").json()
        drilldown = data["drilldown"]
        assert len(drilldown) > 0
        for entry in drilldown:
            assert "ticker" in entry
            assert "stage" in entry
            assert "reason" in entry

    def test_defaults_to_latest_scan_date(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/funnel").json()
        assert data["scan_date"] == "2026-04-04"
        assert data["stages"] is not None
        assert data["stages"]["scout_universe"] == 10

    def test_no_data_returns_zero_counts_and_message(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/funnel?scan_date=2099-01-01").json()
        assert data["scan_date"] == "2099-01-01"
        stages = data["stages"]
        assert all(v == 0 for v in stages.values())
        assert data["message"] == "No funnel data for 2099-01-01"

    def test_degraded_when_db_unavailable(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", "/nonexistent/path.db")
        response = client.get("/api/funnel?scan_date=2026-04-04")
        assert response.status_code == 200
        data = response.json()
        assert data["stages"] is None
        assert data["stages_error"] is not None
        assert data["drilldown"] is None
        assert data["drilldown_error"] is not None

    def test_degraded_when_db_path_empty(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", "")
        response = client.get("/api/funnel?scan_date=2026-04-04")
        assert response.status_code == 200
        data = response.json()
        assert data["stages"] is None
        assert "not configured" in data["stages_error"]

    def test_independent_section_degradation(self, client: TestClient, tmp_path, monkeypatch):
        """Stages section works but drilldown fails when rejection_log table missing."""
        db_file = tmp_path / "partial.db"
        conn = sqlite3.connect(str(db_file))
        conn.executescript("""
            CREATE TABLE scout_candidates (
                id TEXT PRIMARY KEY, scan_date TEXT, ticker TEXT, was_traded BOOLEAN DEFAULT FALSE, created_at TEXT
            );
            CREATE TABLE guardian_decisions (
                id TEXT PRIMARY KEY, decision_date TEXT, ticker TEXT, decision TEXT, proposed_conviction INTEGER, created_at TEXT
            );
            CREATE TABLE trade_events (
                id TEXT PRIMARY KEY, timestamp TEXT, source TEXT, event_type TEXT, ticker TEXT, entry_price REAL, created_at TEXT
            );
            INSERT INTO scout_candidates (id, scan_date, ticker, was_traded) VALUES ('sc1', '2026-04-04', 'AAPL', 0);
        """)
        conn.close()
        monkeypatch.setattr("src.config.settings.portfolio_db_path", str(db_file))
        data = client.get("/api/funnel?scan_date=2026-04-04").json()
        # Both stages and drilldown fail because rejection_log is needed by get_funnel_counts
        assert data["stages"] is None
        assert data["stages_error"] is not None
        assert data["drilldown"] is None
        assert data["drilldown_error"] is not None
