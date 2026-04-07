"""Tests for GET /api/performance endpoint and performance query functions."""

import sqlite3

from fastapi.testclient import TestClient

from src.db.portfolio import get_portfolio_performance
from src.db.supervisor import get_arena_comparison, get_calibration_scores, get_prediction_accuracy


# ---------------------------------------------------------------------------
# Query-level tests (direct DB functions)
# ---------------------------------------------------------------------------


class TestGetPortfolioPerformance:
    def test_returns_pnl_and_cagr(self, performance_portfolio_db_path: str):
        conn = sqlite3.connect(performance_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_portfolio_performance(conn)
        conn.close()

        assert result["start_date"] == "2026-01-15"
        assert result["end_date"] == "2026-04-04"
        # P&L: 112500 - 100000 = 12500
        assert result["total_pnl"] == 12500.00
        # P&L %: (12500 / 100000) * 100 = 12.5
        assert result["total_pnl_pct"] == 12.5
        assert result["cagr"] is not None
        assert result["cagr"] > 0

    def test_returns_spy_return_and_alpha(self, performance_portfolio_db_path: str):
        conn = sqlite3.connect(performance_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_portfolio_performance(conn)
        conn.close()

        # SPY: (5200 - 4800) / 4800 * 100 = 8.33
        assert result["spy_return"] == round(((5200 - 4800) / 4800) * 100, 2)
        # Alpha = portfolio return - SPY return = 12.5 - 8.33
        assert result["alpha"] is not None
        assert result["alpha"] == round(12.5 - result["spy_return"], 2)

    def test_returns_total_trades(self, performance_portfolio_db_path: str):
        conn = sqlite3.connect(performance_portfolio_db_path)
        conn.row_factory = sqlite3.Row
        result = get_portfolio_performance(conn)
        conn.close()

        # 2 trade_events in sample data
        assert result["total_trades"] == 2

    def test_empty_table_returns_nulls(self, tmp_path):
        db_file = tmp_path / "empty_perf.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE sim_portfolio_snapshots (
                id INTEGER PRIMARY KEY, snapshot_date TEXT, ticker TEXT,
                current_stop_level REAL, exit_stage TEXT,
                portfolio_heat_contribution REAL, sector_concentration_status TEXT,
                portfolio_value REAL, spy_value REAL, created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE trade_events (
                id INTEGER PRIMARY KEY, scan_date TEXT, ticker TEXT,
                action TEXT, shares REAL, price REAL,
                estimated_cost_dollars REAL, created_at TEXT
            )
        """)
        conn.commit()
        conn.row_factory = sqlite3.Row
        result = get_portfolio_performance(conn)
        conn.close()

        assert result["total_pnl"] is None
        assert result["cagr"] is None
        assert result["spy_return"] is None
        assert result["alpha"] is None
        assert result["total_trades"] == 0


class TestGetPredictionAccuracy:
    def test_returns_prediction_counts(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_prediction_accuracy(conn)
        conn.close()

        assert result["total_predictions"] == 6
        assert result["resolved_count"] == 5

    def test_returns_hit_rate(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_prediction_accuracy(conn)
        conn.close()

        # 5 eval_results: hits are 1, 0, 1, 0, 1 = 3/5 = 0.6
        assert result["hit_rate"] == 0.6

    def test_returns_hit_rate_by_window(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_prediction_accuracy(conn)
        conn.close()

        by_window = result["hit_rate_by_window"]
        # T+5: 2 evals (hit=1, hit=0) -> 0.5
        assert by_window["t_5"] == 0.5
        # T+10: 2 evals (hit=0, hit=1) -> 0.5
        assert by_window["t_10"] == 0.5
        # T+20: 1 eval (hit=1) -> 1.0
        assert by_window["t_20"] == 1.0

    def test_returns_average_brier_score(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_prediction_accuracy(conn)
        conn.close()

        # Resolved predictions with brier: 0.0625, 0.36, 0.04, 0.3025, 0.09
        # Avg = (0.0625 + 0.36 + 0.04 + 0.3025 + 0.09) / 5 = 0.171
        assert result["average_brier_score"] is not None
        assert 0.15 < result["average_brier_score"] < 0.20

    def test_empty_predictions_returns_zeros(self, tmp_path):
        db_file = tmp_path / "empty_pred.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE predictions (
                id INTEGER PRIMARY KEY, ticker TEXT, scan_date TEXT,
                predicted_outcome TEXT, probability REAL, eval_window TEXT,
                resolved INTEGER DEFAULT 0, actual_outcome TEXT, brier_score REAL, created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE eval_results (
                id INTEGER PRIMARY KEY, prediction_id INTEGER, eval_window TEXT,
                hit INTEGER DEFAULT 0, forward_return REAL, evaluated_at TEXT
            )
        """)
        conn.commit()
        conn.row_factory = sqlite3.Row
        result = get_prediction_accuracy(conn)
        conn.close()

        assert result["total_predictions"] == 0
        assert result["resolved_count"] == 0
        assert result["hit_rate"] is None


class TestGetCalibrationScores:
    def test_returns_calibration_metrics(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_calibration_scores(conn)
        conn.close()

        assert result["target_brier"] == 0.25
        assert result["average_brier_score"] is not None
        assert isinstance(result["beating_random"], bool)
        assert result["agreement_rate"] is not None
        assert isinstance(result["sycophancy_flag"], bool)

    def test_beating_random_flag(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_calibration_scores(conn)
        conn.close()

        # Avg brier ~ 0.171 < 0.25, so beating_random = True
        assert result["beating_random"] is True

    def test_empty_returns_nulls(self, tmp_path):
        db_file = tmp_path / "empty_cal.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE predictions (
                id INTEGER PRIMARY KEY, ticker TEXT, scan_date TEXT,
                predicted_outcome TEXT, probability REAL, eval_window TEXT,
                resolved INTEGER DEFAULT 0, actual_outcome TEXT, brier_score REAL, created_at TEXT
            )
        """)
        conn.commit()
        conn.row_factory = sqlite3.Row
        result = get_calibration_scores(conn)
        conn.close()

        assert result["average_brier_score"] is None
        assert result["beating_random"] is None
        assert result["agreement_rate"] is None
        assert result["sycophancy_flag"] is None
        assert result["target_brier"] == 0.25


class TestGetArenaComparison:
    def test_returns_per_model_stats(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_arena_comparison(conn)
        conn.close()

        assert len(result) == 2  # claude-sonnet and gpt-4o
        models = {r["model_id"] for r in result}
        assert "claude-sonnet" in models
        assert "gpt-4o" in models

    def test_claude_sonnet_stats(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_arena_comparison(conn)
        conn.close()

        sonnet = next(r for r in result if r["model_id"] == "claude-sonnet")
        assert sonnet["session"] == "2026-03-arena-1"
        assert sonnet["total_decisions"] == 3
        # forward_returns: 3.5, -2.1, 5.2 -> hits: 2/3
        assert sonnet["hit_rate"] == round(2 / 3, 4)
        assert sonnet["total_cost"] == 1.50  # 3 * 0.50

    def test_gpt4o_stats(self, performance_supervisor_db_path: str):
        conn = sqlite3.connect(performance_supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_arena_comparison(conn)
        conn.close()

        gpt = next(r for r in result if r["model_id"] == "gpt-4o")
        assert gpt["total_decisions"] == 2
        # forward_returns: 3.5, -2.1 -> hits: 1/2
        assert gpt["hit_rate"] == 0.5
        assert gpt["total_cost"] == 1.60  # 2 * 0.80

    def test_empty_arena_returns_empty_list(self, tmp_path):
        db_file = tmp_path / "empty_arena.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute("""
            CREATE TABLE arena_decisions (
                id INTEGER PRIMARY KEY, session_id TEXT, model_id TEXT,
                ticker TEXT, scan_date TEXT, decision TEXT, cost_usd REAL, created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE arena_forward_returns (
                id INTEGER PRIMARY KEY, arena_decision_id INTEGER,
                forward_return REAL, evaluated_at TEXT
            )
        """)
        conn.commit()
        conn.row_factory = sqlite3.Row
        result = get_arena_comparison(conn)
        conn.close()

        assert result == []


# ---------------------------------------------------------------------------
# Endpoint-level tests
# ---------------------------------------------------------------------------


class TestPerformanceEndpoint:
    def test_returns_200_with_all_sections(
        self, client: TestClient, performance_portfolio_db_path: str,
        performance_supervisor_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", performance_portfolio_db_path)
        monkeypatch.setattr("src.config.settings.supervisor_db_path", performance_supervisor_db_path)
        response = client.get("/api/performance")
        assert response.status_code == 200
        data = response.json()
        assert data["portfolio_summary"] is not None
        assert data["portfolio_summary_error"] is None
        assert data["prediction_accuracy"] is not None
        assert data["prediction_accuracy_error"] is None
        assert data["calibration"] is not None
        assert data["calibration_error"] is None
        assert data["arena_comparison"] is not None
        assert data["arena_comparison_error"] is None

    def test_portfolio_summary_fields(
        self, client: TestClient, performance_portfolio_db_path: str,
        performance_supervisor_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", performance_portfolio_db_path)
        monkeypatch.setattr("src.config.settings.supervisor_db_path", performance_supervisor_db_path)
        data = client.get("/api/performance").json()
        summary = data["portfolio_summary"]
        assert summary["total_pnl"] == 12500.00
        assert summary["total_pnl_pct"] == 12.5
        assert summary["cagr"] is not None
        assert summary["spy_return"] is not None
        assert summary["alpha"] is not None
        assert summary["start_date"] == "2026-01-15"
        assert summary["end_date"] == "2026-04-04"
        assert summary["total_trades"] == 2

    def test_prediction_accuracy_fields(
        self, client: TestClient, performance_portfolio_db_path: str,
        performance_supervisor_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", performance_portfolio_db_path)
        monkeypatch.setattr("src.config.settings.supervisor_db_path", performance_supervisor_db_path)
        data = client.get("/api/performance").json()
        pred = data["prediction_accuracy"]
        assert pred["total_predictions"] == 6
        assert pred["resolved_count"] == 5
        assert pred["hit_rate"] is not None
        assert "t_5" in pred["hit_rate_by_window"]
        assert "t_10" in pred["hit_rate_by_window"]
        assert "t_20" in pred["hit_rate_by_window"]
        assert pred["average_brier_score"] is not None

    def test_calibration_fields(
        self, client: TestClient, performance_portfolio_db_path: str,
        performance_supervisor_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", performance_portfolio_db_path)
        monkeypatch.setattr("src.config.settings.supervisor_db_path", performance_supervisor_db_path)
        data = client.get("/api/performance").json()
        cal = data["calibration"]
        assert cal["target_brier"] == 0.25
        assert cal["average_brier_score"] is not None
        assert isinstance(cal["beating_random"], bool)
        assert cal["agreement_rate"] is not None
        assert isinstance(cal["sycophancy_flag"], bool)

    def test_arena_comparison_fields(
        self, client: TestClient, performance_portfolio_db_path: str,
        performance_supervisor_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", performance_portfolio_db_path)
        monkeypatch.setattr("src.config.settings.supervisor_db_path", performance_supervisor_db_path)
        data = client.get("/api/performance").json()
        arena = data["arena_comparison"]
        assert len(arena) == 2
        models = {a["model_id"] for a in arena}
        assert "claude-sonnet" in models
        assert "gpt-4o" in models
        for entry in arena:
            assert "session" in entry
            assert "total_decisions" in entry
            assert "hit_rate" in entry
            assert "average_alpha" in entry
            assert "total_cost" in entry

    def test_portfolio_db_unavailable_returns_section_error(
        self, client: TestClient, performance_supervisor_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", "")
        monkeypatch.setattr("src.config.settings.supervisor_db_path", performance_supervisor_db_path)
        response = client.get("/api/performance")
        assert response.status_code == 200
        data = response.json()
        assert data["portfolio_summary"] is None
        assert "not configured" in data["portfolio_summary_error"]
        # Supervisor sections should still work
        assert data["prediction_accuracy"] is not None
        assert data["prediction_accuracy_error"] is None
        assert data["calibration"] is not None
        assert data["arena_comparison"] is not None

    def test_supervisor_db_unavailable_returns_section_errors(
        self, client: TestClient, performance_portfolio_db_path: str, monkeypatch,
    ):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", performance_portfolio_db_path)
        monkeypatch.setattr("src.config.settings.supervisor_db_path", "")
        response = client.get("/api/performance")
        assert response.status_code == 200
        data = response.json()
        # Portfolio should still work
        assert data["portfolio_summary"] is not None
        assert data["portfolio_summary_error"] is None
        # Supervisor sections should have errors
        assert data["prediction_accuracy"] is None
        assert "not configured" in data["prediction_accuracy_error"]
        assert data["calibration"] is None
        assert "not configured" in data["calibration_error"]
        assert data["arena_comparison"] is None
        assert "not configured" in data["arena_comparison_error"]

    def test_empty_tables_return_graceful_nulls(
        self, client: TestClient, tmp_path, monkeypatch,
    ):
        # Portfolio DB with empty performance tables
        portfolio_file = tmp_path / "empty_portfolio.db"
        conn = sqlite3.connect(str(portfolio_file))
        conn.execute("""
            CREATE TABLE sim_portfolio_snapshots (
                id INTEGER PRIMARY KEY, snapshot_date TEXT, ticker TEXT,
                current_stop_level REAL, exit_stage TEXT,
                portfolio_heat_contribution REAL, sector_concentration_status TEXT,
                portfolio_value REAL, spy_value REAL, created_at TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE trade_events (
                id INTEGER PRIMARY KEY, scan_date TEXT, ticker TEXT,
                action TEXT, shares REAL, price REAL,
                estimated_cost_dollars REAL, created_at TEXT
            )
        """)
        conn.commit()
        conn.close()

        # Supervisor DB with empty performance tables
        supervisor_file = tmp_path / "empty_supervisor.db"
        conn = sqlite3.connect(str(supervisor_file))
        conn.executescript("""
            CREATE TABLE health_checks (
                id INTEGER PRIMARY KEY, agent_name TEXT, status TEXT,
                last_run TEXT, details TEXT, checked_at TEXT
            );
            CREATE TABLE events (
                id INTEGER PRIMARY KEY, source TEXT, event_type TEXT,
                data TEXT, created_at TEXT
            );
            CREATE TABLE predictions (
                id INTEGER PRIMARY KEY, ticker TEXT, scan_date TEXT,
                predicted_outcome TEXT, probability REAL, eval_window TEXT,
                resolved INTEGER DEFAULT 0, actual_outcome TEXT, brier_score REAL, created_at TEXT
            );
            CREATE TABLE eval_results (
                id INTEGER PRIMARY KEY, prediction_id INTEGER, eval_window TEXT,
                hit INTEGER DEFAULT 0, forward_return REAL, evaluated_at TEXT
            );
            CREATE TABLE arena_decisions (
                id INTEGER PRIMARY KEY, session_id TEXT, model_id TEXT,
                ticker TEXT, scan_date TEXT, decision TEXT, cost_usd REAL, created_at TEXT
            );
            CREATE TABLE arena_forward_returns (
                id INTEGER PRIMARY KEY, arena_decision_id INTEGER,
                forward_return REAL, evaluated_at TEXT
            );
        """)
        conn.close()

        monkeypatch.setattr("src.config.settings.portfolio_db_path", str(portfolio_file))
        monkeypatch.setattr("src.config.settings.supervisor_db_path", str(supervisor_file))
        response = client.get("/api/performance")
        assert response.status_code == 200
        data = response.json()

        # Portfolio summary: null P&L since no data
        assert data["portfolio_summary_error"] is None
        summary = data["portfolio_summary"]
        assert summary["total_pnl"] is None
        assert summary["cagr"] is None

        # Prediction: empty
        assert data["prediction_accuracy_error"] is None
        pred = data["prediction_accuracy"]
        assert pred["total_predictions"] == 0

        # Calibration: nulls
        assert data["calibration_error"] is None
        cal = data["calibration"]
        assert cal["average_brier_score"] is None

        # Arena: empty list
        assert data["arena_comparison_error"] is None
        assert data["arena_comparison"] == []

    def test_both_dbs_unavailable(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.portfolio_db_path", "")
        monkeypatch.setattr("src.config.settings.supervisor_db_path", "")
        response = client.get("/api/performance")
        assert response.status_code == 200
        data = response.json()
        assert data["portfolio_summary"] is None
        assert data["portfolio_summary_error"] is not None
        assert data["prediction_accuracy"] is None
        assert data["prediction_accuracy_error"] is not None
        assert data["calibration"] is None
        assert data["calibration_error"] is not None
        assert data["arena_comparison"] is None
        assert data["arena_comparison_error"] is not None
