"""Tests for debug API endpoints: events, logs, and pipeline replay."""

import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from src.db.debug import get_pipeline_replay, get_raw_events
from tests.conftest import (
    PORTFOLIO_FUNNEL_SCHEMA,
    PORTFOLIO_FUNNEL_SAMPLE_DATA,
    PORTFOLIO_HOLDINGS_SCHEMA,
    PORTFOLIO_PERFORMANCE_SAMPLE_DATA,
    SUPERVISOR_SCHEMA,
    SUPERVISOR_SAMPLE_DATA,
)


# ── Fixtures ──────────────────────────────────────────────────────────────


@pytest.fixture
def debug_supervisor_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "supervisor_debug.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def debug_portfolio_db_path(tmp_path: Path) -> str:
    db_file = tmp_path / "portfolio_debug.db"
    conn = sqlite3.connect(str(db_file))
    conn.executescript(PORTFOLIO_FUNNEL_SCHEMA)
    conn.executescript(PORTFOLIO_FUNNEL_SAMPLE_DATA)
    conn.executescript(PORTFOLIO_HOLDINGS_SCHEMA)
    conn.executescript(PORTFOLIO_PERFORMANCE_SAMPLE_DATA)
    conn.close()
    return str(db_file)


@pytest.fixture
def log_dir(tmp_path: Path) -> str:
    log_path = tmp_path / "logs"
    log_path.mkdir()
    # Create a sample log file
    scout_log = log_path / "scout.log"
    scout_log.write_text(
        "2026-04-04 06:00:00 - Scout - INFO - Scan started for 1520 tickers\n"
        "2026-04-04 06:01:00 - Scout - INFO - Gate evaluation complete\n"
        "2026-04-04 06:02:00 - Scout - ERROR - Failed to fetch AAPL data\n"
        "Traceback (most recent call last):\n"
        '  File "scout.py", line 42, in fetch_data\n'
        "    response = requests.get(url)\n"
        "ConnectionError: Connection refused\n"
        "2026-04-04 06:03:00 - Scout - WARNING - Retrying AAPL fetch\n"
        "2026-04-04 06:04:00 - Scout - INFO - Scan complete: 7 passed gates\n"
    )
    guardian_log = log_path / "guardian.log"
    guardian_log.write_text(
        "2026-04-04 07:00:00 - Guardian - INFO - Starting decision cycle\n"
        "2026-04-04 07:01:00 - Guardian - INFO - AAPL approved (high conviction)\n"
    )
    return str(log_path)


# ── Query-level tests: get_raw_events ─────────────────────────────────────


class TestGetRawEvents:
    def test_returns_all_events(self, debug_supervisor_db_path):
        conn = sqlite3.connect(f"file:{debug_supervisor_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        events = get_raw_events(conn)
        conn.close()
        assert len(events) > 0
        assert all("id" in e and "source" in e and "event_type" in e for e in events)

    def test_filter_by_source(self, debug_supervisor_db_path):
        conn = sqlite3.connect(f"file:{debug_supervisor_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        events = get_raw_events(conn, source="shadow_observer")
        conn.close()
        assert len(events) > 0
        assert all(e["source"] == "shadow_observer" for e in events)

    def test_filter_by_event_type(self, debug_supervisor_db_path):
        conn = sqlite3.connect(f"file:{debug_supervisor_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        events = get_raw_events(conn, event_type="alert")
        conn.close()
        assert len(events) > 0
        assert all(e["event_type"] == "alert" for e in events)

    def test_filter_by_since(self, debug_supervisor_db_path):
        conn = sqlite3.connect(f"file:{debug_supervisor_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        events = get_raw_events(conn, since="2026-04-04T06:00:00Z")
        conn.close()
        assert len(events) > 0
        assert all(e["timestamp"] >= "2026-04-04T06:00:00Z" for e in events)

    def test_limit_clamped(self, debug_supervisor_db_path):
        conn = sqlite3.connect(f"file:{debug_supervisor_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        events = get_raw_events(conn, limit=2)
        conn.close()
        assert len(events) <= 2

    def test_combined_filters(self, debug_supervisor_db_path):
        conn = sqlite3.connect(f"file:{debug_supervisor_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        events = get_raw_events(conn, source="Guardian", event_type="alert")
        conn.close()
        assert len(events) >= 1
        assert all(e["source"] == "Guardian" and e["event_type"] == "alert" for e in events)


# ── Query-level tests: get_pipeline_replay ────────────────────────────────


class TestGetPipelineReplay:
    def test_replay_with_data(self, debug_portfolio_db_path):
        conn = sqlite3.connect(f"file:{debug_portfolio_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        result = get_pipeline_replay(conn, "2026-04-04")
        conn.close()
        assert result["date"] == "2026-04-04"
        assert result["message"] is None
        assert len(result["steps"]) >= 3  # scout, guardian, trades

        step_names = [s["step"] for s in result["steps"]]
        assert "scout_scan" in step_names
        assert "guardian_decisions" in step_names
        assert "trade_events" in step_names

    def test_replay_scout_detail(self, debug_portfolio_db_path):
        conn = sqlite3.connect(f"file:{debug_portfolio_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        result = get_pipeline_replay(conn, "2026-04-04")
        conn.close()
        scout = next(s for s in result["steps"] if s["step"] == "scout_scan")
        assert scout["detail"]["total_scanned"] == 10
        assert scout["detail"]["passed_gates"] == 7
        assert len(scout["detail"]["top_tickers"]) > 0

    def test_replay_no_data(self, debug_portfolio_db_path):
        conn = sqlite3.connect(f"file:{debug_portfolio_db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        result = get_pipeline_replay(conn, "2020-01-01")
        conn.close()
        assert result["steps"] == []
        assert "No pipeline run" in result["message"]


# ── Endpoint-level tests ──────────────────────────────────────────────────


class TestDebugEventsEndpoint:
    def test_events_with_db(self, client, debug_supervisor_db_path):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.supervisor_db_path = debug_supervisor_db_path
            resp = client.get("/api/debug/events")
        assert resp.status_code == 200
        data = resp.json()
        assert "events" in data
        assert len(data["events"]) > 0
        assert data["events_error"] is None

    def test_events_with_filters(self, client, debug_supervisor_db_path):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.supervisor_db_path = debug_supervisor_db_path
            resp = client.get("/api/debug/events?source=shadow_observer&limit=2")
        data = resp.json()
        assert len(data["events"]) <= 2
        assert all(e["source"] == "shadow_observer" for e in data["events"])

    def test_events_no_db(self, client):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.supervisor_db_path = ""
            resp = client.get("/api/debug/events")
        assert resp.status_code == 200
        data = resp.json()
        assert data["events"] == []
        assert data["events_error"] is not None


class TestDebugLogsEndpoint:
    def test_logs_with_files(self, client, log_dir):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.log_dir = log_dir
            resp = client.get("/api/debug/logs?agent=scout")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["logs"]) > 0
        assert data["logs_error"] is None

    def test_logs_severity_filter(self, client, log_dir):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.log_dir = log_dir
            resp = client.get("/api/debug/logs?agent=scout&severity=ERROR")
        data = resp.json()
        assert len(data["logs"]) >= 1
        assert all(log["severity"] == "ERROR" for log in data["logs"])
        # ERROR entries should have stack traces
        error_entry = data["logs"][0]
        assert error_entry["trace"] is not None
        assert "Traceback" in error_entry["trace"]

    def test_logs_date_filter(self, client, log_dir):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.log_dir = log_dir
            resp = client.get("/api/debug/logs?agent=scout&date=2026-04-04")
        data = resp.json()
        assert len(data["logs"]) > 0
        assert all(log["timestamp"].startswith("2026-04-04") for log in data["logs"])

    def test_logs_no_dir(self, client):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.log_dir = ""
            resp = client.get("/api/debug/logs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["logs"] == []

    def test_logs_unknown_agent(self, client, log_dir):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.log_dir = log_dir
            resp = client.get("/api/debug/logs?agent=../etc/passwd")
        data = resp.json()
        assert data["logs"] == []
        assert data["logs_error"] is not None

    def test_logs_no_matching_files(self, client, log_dir):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.log_dir = log_dir
            resp = client.get("/api/debug/logs?agent=chronicler")
        data = resp.json()
        assert data["logs"] == []
        assert data["logs_error"] is None


class TestDebugReplayEndpoint:
    def test_replay_with_data(self, client, debug_portfolio_db_path):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.portfolio_db_path = debug_portfolio_db_path
            resp = client.get("/api/debug/replay?date=2026-04-04")
        assert resp.status_code == 200
        data = resp.json()
        assert data["date"] == "2026-04-04"
        assert len(data["steps"]) >= 3
        assert data["replay_error"] is None

    def test_replay_no_data_for_date(self, client, debug_portfolio_db_path):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.portfolio_db_path = debug_portfolio_db_path
            resp = client.get("/api/debug/replay?date=2020-01-01")
        data = resp.json()
        assert data["steps"] == []
        assert "No pipeline run" in data["message"]

    def test_replay_no_db(self, client):
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.portfolio_db_path = ""
            resp = client.get("/api/debug/replay?date=2026-04-04")
        assert resp.status_code == 200
        data = resp.json()
        assert data["steps"] == []
        assert data["replay_error"] is not None

    def test_replay_date_required(self, client):
        """date is a required query param."""
        with patch("src.routers.debug.settings") as mock_settings:
            mock_settings.portfolio_db_path = ""
            resp = client.get("/api/debug/replay")
        assert resp.status_code == 422
