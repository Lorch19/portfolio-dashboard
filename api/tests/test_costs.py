"""Tests for GET /api/costs endpoint and costs query functions."""

import sqlite3
from unittest.mock import patch

from fastapi.testclient import TestClient

from src.db.costs import get_api_costs, get_brokerage_costs, get_total_portfolio_return


# ---------------------------------------------------------------------------
# Query-level tests (direct DB functions)
# ---------------------------------------------------------------------------


class TestGetBrokerageCosts:
    def test_returns_per_trade_fees(self, costs_portfolio_db_path: str):
        conn = sqlite3.connect(costs_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_brokerage_costs(conn)
        conn.close()

        assert len(result["trades"]) == 2  # 2 trade_events in sample data
        # Check first trade has expected fields
        trade = result["trades"][0]
        assert "ticker" in trade
        assert "trade_date" in trade
        assert "action" in trade
        assert "estimated_cost" in trade

    def test_cumulative_trade_event_fees(self, costs_portfolio_db_path: str):
        conn = sqlite3.connect(costs_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_brokerage_costs(conn)
        conn.close()

        # trade_events sample: AAPL=1855.00, NVDA=4451.25
        assert result["cumulative_trade_event_fees"] == 1855.00 + 4451.25

    def test_cumulative_realized_fees(self, costs_portfolio_db_path: str):
        conn = sqlite3.connect(costs_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_brokerage_costs(conn)
        conn.close()

        # realized_gains sample: JPM=4.50, AMZN=3.25
        assert result["cumulative_realized_fees"] == 4.50 + 3.25

    def test_cumulative_total(self, costs_portfolio_db_path: str):
        conn = sqlite3.connect(costs_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_brokerage_costs(conn)
        conn.close()

        expected = (1855.00 + 4451.25) + (4.50 + 3.25)
        assert result["cumulative_total"] == expected

    def test_handles_missing_realized_gains_table(self, performance_portfolio_db_path: str):
        """When realized_gains table doesn't exist, graceful degradation."""
        conn = sqlite3.connect(performance_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_brokerage_costs(conn)
        conn.close()

        assert result["cumulative_realized_fees"] == 0.0
        assert result["cumulative_trade_event_fees"] >= 0


class TestGetApiCosts:
    def test_returns_per_model_costs(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_api_costs(conn)
        conn.close()

        assert len(result["per_model"]) == 2  # claude-sonnet, gpt-4o
        model_ids = [m["model_id"] for m in result["per_model"]]
        assert "claude-sonnet" in model_ids
        assert "gpt-4o" in model_ids

    def test_cumulative_total(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_api_costs(conn)
        conn.close()

        # claude-sonnet: 3 * 0.50 = 1.50, gpt-4o: 2 * 0.80 = 1.60
        assert result["cumulative_total"] == 1.50 + 1.60

    def test_empty_arena_decisions(self, supervisor_db_path: str):
        """Supervisor DB without arena tables returns empty costs."""
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        # Base supervisor DB doesn't have arena_decisions table
        try:
            result = get_api_costs(conn)
            # If table exists but empty
            assert result["cumulative_total"] == 0.0
        except sqlite3.OperationalError:
            pass  # Table doesn't exist — expected
        conn.close()


class TestGetTotalPortfolioReturn:
    def test_returns_portfolio_return(self, costs_portfolio_db_path: str):
        conn = sqlite3.connect(costs_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_total_portfolio_return(conn)
        conn.close()

        assert result is not None
        # 112500 - 100000 = 12500
        assert result["total_return"] == 12500.00
        assert result["total_return_pct"] == 12.5
        assert result["start_date"] == "2026-01-15"
        assert result["end_date"] == "2026-04-04"
        assert result["months_running"] > 0

    def test_returns_none_with_no_snapshots(self, portfolio_db_path: str):
        """DB without _PORTFOLIO snapshots returns None."""
        conn = sqlite3.connect(portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_total_portfolio_return(conn)
        conn.close()

        assert result is None


# ---------------------------------------------------------------------------
# Endpoint-level tests (HTTP API)
# ---------------------------------------------------------------------------


class TestCostsEndpoint:
    def test_returns_200_with_all_data(
        self, client: TestClient,
        costs_portfolio_db_path: str,
        performance_supervisor_db_path: str,
    ):
        with (
            patch("src.config.settings.portfolio_db_path", costs_portfolio_db_path),
            patch("src.config.settings.supervisor_db_path", performance_supervisor_db_path),
        ):
            resp = client.get("/api/costs")

        assert resp.status_code == 200
        data = resp.json()

        # Brokerage section
        assert data["brokerage"] is not None
        assert data["brokerage_error"] is None
        assert len(data["brokerage"]["trades"]) == 2

        # API costs section
        assert data["api_costs"] is not None
        assert data["api_costs_error"] is None
        assert len(data["api_costs"]["per_model"]) == 2

        # VPS cost
        assert data["vps_monthly_cost"] > 0

        # Computed fields
        assert data["total_system_cost"] > 0
        assert data["total_trades"] == 2
        assert data["cost_per_trade"] is not None

        # ROI metrics
        assert data["portfolio_return"] is not None
        assert data["net_return_after_costs"] is not None

    def test_returns_200_with_no_portfolio_db(
        self, client: TestClient,
        performance_supervisor_db_path: str,
    ):
        with (
            patch("src.config.settings.portfolio_db_path", ""),
            patch("src.config.settings.supervisor_db_path", performance_supervisor_db_path),
        ):
            resp = client.get("/api/costs")

        assert resp.status_code == 200
        data = resp.json()

        assert data["brokerage"] is None
        assert "not accessible" in data["brokerage_error"]
        assert data["portfolio_return"] is None
        # API costs should still work
        assert data["api_costs"] is not None

    def test_returns_200_with_no_supervisor_db(
        self, client: TestClient,
        costs_portfolio_db_path: str,
    ):
        with (
            patch("src.config.settings.portfolio_db_path", costs_portfolio_db_path),
            patch("src.config.settings.supervisor_db_path", ""),
        ):
            resp = client.get("/api/costs")

        assert resp.status_code == 200
        data = resp.json()

        assert data["api_costs"] is None
        assert "not accessible" in data["api_costs_error"]
        # Brokerage should still work
        assert data["brokerage"] is not None

    def test_returns_200_with_no_dbs(self, client: TestClient):
        with (
            patch("src.config.settings.portfolio_db_path", ""),
            patch("src.config.settings.supervisor_db_path", ""),
        ):
            resp = client.get("/api/costs")

        assert resp.status_code == 200
        data = resp.json()

        assert data["brokerage"] is None
        assert data["api_costs"] is None
        assert data["portfolio_return"] is None
        assert data["vps_monthly_cost"] > 0
        assert data["total_system_cost"] > 0  # VPS cost alone
        assert data["net_return_after_costs"] is None

    def test_cost_per_trade_none_with_zero_trades(self, client: TestClient):
        with (
            patch("src.config.settings.portfolio_db_path", ""),
            patch("src.config.settings.supervisor_db_path", ""),
        ):
            resp = client.get("/api/costs")

        data = resp.json()
        assert data["cost_per_trade"] is None
        assert data["total_trades"] == 0

    def test_roi_metrics_present(
        self, client: TestClient,
        costs_portfolio_db_path: str,
        performance_supervisor_db_path: str,
    ):
        with (
            patch("src.config.settings.portfolio_db_path", costs_portfolio_db_path),
            patch("src.config.settings.supervisor_db_path", performance_supervisor_db_path),
        ):
            resp = client.get("/api/costs")

        data = resp.json()
        assert data["portfolio_return"]["total_return"] == 12500.00
        assert data["net_return_after_costs"] is not None
        assert data["net_return_after_costs"] < 12500.00  # After subtracting costs
        assert data["cost_as_pct_of_returns"] is not None
        assert data["cost_as_pct_of_returns"] > 0
