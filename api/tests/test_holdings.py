"""Tests for GET /api/holdings endpoint and portfolio holdings query functions."""

import sqlite3
from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient

from src.db.portfolio import get_open_positions, get_portfolio_risk_data
from src.main import app


# ---------------------------------------------------------------------------
# Query-level tests (direct DB functions)
# ---------------------------------------------------------------------------


class TestGetOpenPositions:
    def test_returns_open_positions_only(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        tickers = {p["ticker"] for p in positions}
        assert "AAPL" in tickers
        assert "MSFT" in tickers
        assert "NVDA" in tickers
        assert "TSLA" in tickers
        # JPM is closed — must NOT appear
        assert "JPM" not in tickers
        assert len(positions) == 4

    def test_includes_all_required_fields(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        required_fields = {
            "ticker", "sector", "entry_price", "entry_date", "current_price",
            "shares", "unrealized_pnl", "unrealized_pnl_pct", "sleeve",
            "stop_loss", "target_1", "target_2", "conviction", "days_held",
        }
        for pos in positions:
            assert required_fields.issubset(pos.keys()), f"Missing fields in {pos['ticker']}"

    def test_unrealized_pnl_calculated_correctly(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        aapl = next(p for p in positions if p["ticker"] == "AAPL")
        # (185.50 - 175.50) * 10 = 100.00
        assert aapl["unrealized_pnl"] == 100.00
        # ((185.50 - 175.50) / 175.50) * 100 = 5.70
        assert aapl["unrealized_pnl_pct"] == round(((185.50 - 175.50) / 175.50) * 100, 2)

    def test_negative_pnl(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        msft = next(p for p in positions if p["ticker"] == "MSFT")
        # (410.00 - 420.00) * 5 = -50.00
        assert msft["unrealized_pnl"] == -50.00
        assert msft["unrealized_pnl_pct"] < 0

    def test_zero_pnl(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        nvda = next(p for p in positions if p["ticker"] == "NVDA")
        # (890.00 - 890.00) * 3 = 0.00
        assert nvda["unrealized_pnl"] == 0.00
        assert nvda["unrealized_pnl_pct"] == 0.00

    def test_days_held_computed(self, portfolio_db_path: str):
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        aapl = next(p for p in positions if p["ticker"] == "AAPL")
        expected_days = (date.today() - date.fromisoformat("2026-03-15")).days
        assert aapl["days_held"] == expected_days
        assert isinstance(aapl["days_held"], int)

    def test_returns_empty_list_when_no_open_positions(self, tmp_path):
        db_file = tmp_path / "empty_holdings.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE sim_positions (
                id TEXT PRIMARY KEY, trade_event_id TEXT, ticker TEXT, sector TEXT,
                entry_price REAL, entry_date TEXT, shares INTEGER,
                stop_loss REAL, target_1 REAL, target_2 REAL,
                conviction INTEGER, sleeve TEXT, status TEXT, peak_price REAL,
                exit_price REAL, exit_date TEXT, pnl_pct REAL, days_held INTEGER, created_at TEXT
            )
        """)
        # Insert only a closed position
        conn.execute(
            "INSERT INTO sim_positions (id, ticker, sector, entry_price, entry_date, peak_price, shares, status, sleeve, conviction) "
            "VALUES ('sp-xyz', 'XYZ', 'Tech', 100.0, '2026-01-01', 110.0, 5, 'closed', 'sleeve1', 3)"
        )
        conn.commit()
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        assert positions == []

    def test_null_numeric_columns_handled_gracefully(self, tmp_path):
        db_file = tmp_path / "null_nums.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE sim_positions (
                id TEXT PRIMARY KEY, trade_event_id TEXT, ticker TEXT, sector TEXT,
                entry_price REAL, entry_date TEXT, shares INTEGER,
                stop_loss REAL, target_1 REAL, target_2 REAL,
                conviction INTEGER, sleeve TEXT, status TEXT, peak_price REAL,
                exit_price REAL, exit_date TEXT, pnl_pct REAL, days_held INTEGER, created_at TEXT
            )
        """)
        conn.execute(
            "INSERT INTO sim_positions (id, ticker, sector, entry_price, entry_date, peak_price, shares, status, sleeve, conviction) "
            "VALUES ('sp-null', 'NULL_TEST', 'Tech', NULL, '2026-01-01', 100.0, 5, 'open', 'sleeve1', 3)"
        )
        conn.commit()
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        assert len(positions) == 1
        assert positions[0]["ticker"] == "NULL_TEST"
        assert positions[0]["unrealized_pnl"] is None
        assert positions[0]["unrealized_pnl_pct"] is None

    def test_entry_price_zero_pnl_pct_is_none(self, tmp_path):
        db_file = tmp_path / "zero_price.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE sim_positions (
                id TEXT PRIMARY KEY, trade_event_id TEXT, ticker TEXT, sector TEXT,
                entry_price REAL, entry_date TEXT, shares INTEGER,
                stop_loss REAL, target_1 REAL, target_2 REAL,
                conviction INTEGER, sleeve TEXT, status TEXT, peak_price REAL,
                exit_price REAL, exit_date TEXT, pnl_pct REAL, days_held INTEGER, created_at TEXT
            )
        """)
        conn.execute(
            "INSERT INTO sim_positions (id, ticker, sector, entry_price, entry_date, peak_price, shares, status, sleeve, conviction) "
            "VALUES ('sp-zero', 'ZERO', 'Tech', 0.0, '2026-01-01', 10.0, 1, 'open', 'sleeve1', 3)"
        )
        conn.commit()
        conn.row_factory = sqlite3.Row
        positions = get_open_positions(conn)
        conn.close()
        assert len(positions) == 1
        assert positions[0]["unrealized_pnl_pct"] is None


class TestGetPortfolioRiskData:
    def test_returns_empty_dict(self, portfolio_db_path: str):
        """Risk data returns empty dict — real schema doesn't have per-ticker risk in snapshots."""
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        risk = get_portfolio_risk_data(conn)
        conn.close()
        assert risk == {}


# ---------------------------------------------------------------------------
# Endpoint-level tests
# ---------------------------------------------------------------------------


class TestHoldingsEndpoint:
    def test_returns_200_with_positions(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        response = client.get("/api/holdings")
        assert response.status_code == 200
        data = response.json()
        assert data["positions"] is not None
        assert data["positions_error"] is None
        assert data["risk_data_error"] is None
        assert len(data["positions"]) == 4

    def test_positions_include_all_fields(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/holdings").json()
        required_fields = {
            "ticker", "sector", "entry_price", "entry_date", "current_price",
            "shares", "unrealized_pnl", "unrealized_pnl_pct", "sleeve",
            "stop_loss", "target_1", "target_2", "conviction", "days_held",
            "current_stop_level", "exit_stage", "portfolio_heat_contribution",
            "sector_concentration_status",
        }
        for pos in data["positions"]:
            assert required_fields.issubset(pos.keys()), f"Missing fields in {pos['ticker']}"

    def test_positions_have_null_risk_fields(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        """Risk data not available in new schema — all positions get null risk fields."""
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/holdings").json()
        for pos in data["positions"]:
            assert pos["current_stop_level"] is None
            assert pos["exit_stage"] is None
            assert pos["portfolio_heat_contribution"] is None
            assert pos["sector_concentration_status"] is None

    def test_only_open_positions_returned(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/holdings").json()
        tickers = {p["ticker"] for p in data["positions"]}
        assert "JPM" not in tickers  # closed position

    def test_no_open_positions_returns_empty_with_message(self, client: TestClient, tmp_path, monkeypatch):
        db_file = tmp_path / "empty.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE sim_positions (
                id TEXT PRIMARY KEY, trade_event_id TEXT, ticker TEXT, sector TEXT,
                entry_price REAL, entry_date TEXT, shares INTEGER,
                stop_loss REAL, target_1 REAL, target_2 REAL,
                conviction INTEGER, sleeve TEXT, status TEXT, peak_price REAL,
                exit_price REAL, exit_date TEXT, pnl_pct REAL, days_held INTEGER, created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE sim_portfolio_snapshots (
                date TEXT NOT NULL, strategy_id TEXT NOT NULL DEFAULT 'live',
                total_value REAL, sp500_return_pct REAL, alpha_pct REAL,
                total_pnl_pct REAL, regime TEXT, created_at TEXT,
                PRIMARY KEY (date, strategy_id)
            )
        """)
        conn.commit()
        conn.close()
        monkeypatch.setattr("src.config.settings.portfolio_db_path", str(db_file))
        data = client.get("/api/holdings").json()
        assert data["positions"] == []
        assert data["positions_error"] is None
        assert data["message"] == "No open positions"

    def test_degraded_when_db_unavailable(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", "/nonexistent/path.db")
        response = client.get("/api/holdings")
        assert response.status_code == 200
        data = response.json()
        assert data["positions"] is None
        assert data["positions_error"] is not None
        assert data["risk_data_error"] is not None

    def test_degraded_when_db_path_empty(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", "")
        response = client.get("/api/holdings")
        assert response.status_code == 200
        data = response.json()
        assert data["positions"] is None
        assert "not configured" in data["positions_error"]

    def test_independent_section_degradation(self, client: TestClient, tmp_path, monkeypatch):
        """Positions work even when sim_portfolio_snapshots table missing (risk data returns empty)."""
        db_file = tmp_path / "partial.db"
        conn = sqlite3.connect(str(db_file))
        conn.executescript("""
            CREATE TABLE sim_positions (
                id TEXT PRIMARY KEY, trade_event_id TEXT, ticker TEXT, sector TEXT,
                entry_price REAL, entry_date TEXT, shares INTEGER,
                stop_loss REAL, target_1 REAL, target_2 REAL,
                conviction INTEGER, sleeve TEXT, status TEXT, peak_price REAL,
                exit_price REAL, exit_date TEXT, pnl_pct REAL, days_held INTEGER, created_at TEXT
            );
            INSERT INTO sim_positions (id, ticker, sector, entry_price, entry_date, peak_price, shares, status, sleeve, conviction)
            VALUES ('sp-test', 'TEST', 'Tech', 100.0, '2026-03-01', 110.0, 10, 'open', 'sleeve1', 5);
        """)
        conn.close()
        monkeypatch.setattr("src.config.settings.portfolio_db_path", str(db_file))
        data = client.get("/api/holdings").json()
        # Positions work
        assert data["positions"] is not None
        assert data["positions_error"] is None
        assert len(data["positions"]) == 1
        assert data["positions"][0]["ticker"] == "TEST"
        # Risk data returns empty (no per-ticker risk in new schema)
        assert data["risk_data_error"] is None
        # Positions have null risk fields (default)
        assert data["positions"][0]["current_stop_level"] is None

    def test_pnl_values_rounded_to_2dp(self, client: TestClient, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", portfolio_db_path)
        data = client.get("/api/holdings").json()
        for pos in data["positions"]:
            pnl = pos["unrealized_pnl"]
            pnl_pct = pos["unrealized_pnl_pct"]
            if pnl is not None:
                assert pnl == round(pnl, 2)
            if pnl_pct is not None:
                assert pnl_pct == round(pnl_pct, 2)
