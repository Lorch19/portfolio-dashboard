"""Tests for GET /api/supervisor endpoint and supervisor query functions."""

import os
import sqlite3

import pytest
from fastapi.testclient import TestClient

from src.config import STRANGLER_FIG_STATUS, get_strangler_fig_status
from src.db.supervisor import (
    get_daemon_status,
    get_hold_point_status,
    get_shadow_observer_events,
)
from src.main import app


# ---------------------------------------------------------------------------
# Query-level tests (direct DB functions)
# ---------------------------------------------------------------------------


class TestGetShadowObserverEvents:
    def test_returns_only_shadow_observer_source(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        events = get_shadow_observer_events(conn)
        conn.close()
        assert len(events) > 0
        for event in events:
            assert event["source"] == "shadow_observer"

    def test_ordered_by_created_at_desc(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        events = get_shadow_observer_events(conn)
        conn.close()
        timestamps = [e["created_at"] for e in events]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_respects_limit(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        events = get_shadow_observer_events(conn, limit=1)
        conn.close()
        assert len(events) == 1

    def test_returns_empty_when_no_events(self, tmp_path):
        db_file = tmp_path / "empty.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute(
            "CREATE TABLE events (id INTEGER PRIMARY KEY, timestamp TEXT, source TEXT, event_type TEXT, strategy_id TEXT, payload TEXT, processed INTEGER DEFAULT 0, created_at TEXT)"
        )
        conn.row_factory = sqlite3.Row
        events = get_shadow_observer_events(conn)
        conn.close()
        assert events == []


class TestGetHoldPointStatus:
    def test_returns_state_and_events(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_hold_point_status(conn)
        conn.close()
        assert "state" in result
        assert "events" in result
        assert result["state"] in ("active", "paused")
        assert isinstance(result["events"], list)

    def test_finds_hold_and_drawdown_events(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        result = get_hold_point_status(conn)
        conn.close()
        # We inserted drawdown_pause and hold_point_triggered events
        assert len(result["events"]) >= 2
        event_types = {e["event_type"] for e in result["events"]}
        assert "drawdown_pause" in event_types or "hold_point_triggered" in event_types

    def test_paused_when_latest_is_pause(self, tmp_path):
        db_file = tmp_path / "pause.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute(
            "CREATE TABLE events (id INTEGER PRIMARY KEY, timestamp TEXT, source TEXT, event_type TEXT, strategy_id TEXT, payload TEXT, processed INTEGER DEFAULT 0, created_at TEXT)"
        )
        conn.execute(
            "INSERT INTO events (source, event_type, payload, created_at) VALUES ('guardian', 'drawdown_pause', '{}', '2026-04-04T10:00:00Z')"
        )
        conn.row_factory = sqlite3.Row
        result = get_hold_point_status(conn)
        conn.close()
        assert result["state"] == "paused"

    def test_active_when_no_hold_events(self, tmp_path):
        db_file = tmp_path / "active.db"
        conn = sqlite3.connect(str(db_file))
        conn.execute(
            "CREATE TABLE events (id INTEGER PRIMARY KEY, timestamp TEXT, source TEXT, event_type TEXT, strategy_id TEXT, payload TEXT, processed INTEGER DEFAULT 0, created_at TEXT)"
        )
        conn.row_factory = sqlite3.Row
        result = get_hold_point_status(conn)
        conn.close()
        assert result["state"] == "active"
        assert result["events"] == []


class TestGetDaemonStatus:
    def test_returns_latest_per_component(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        daemons = get_daemon_status(conn)
        conn.close()
        # 6 agents in sample data
        assert len(daemons) == 6
        components = {d["component"] for d in daemons}
        assert "Scout" in components
        assert "Shadow Observer" in components

    def test_each_daemon_has_required_fields(self, supervisor_db_path: str):
        conn = sqlite3.connect(supervisor_db_path)
        conn.row_factory = sqlite3.Row
        daemons = get_daemon_status(conn)
        conn.close()
        for d in daemons:
            assert "component" in d
            assert "status" in d
            assert "checked_at" in d


# ---------------------------------------------------------------------------
# Strangler Fig config tests
# ---------------------------------------------------------------------------


class TestStranglerFigConfig:
    def test_all_components_present(self):
        assert len(STRANGLER_FIG_STATUS) == 8
        assert "Scout" in STRANGLER_FIG_STATUS
        assert "Shadow Observer" in STRANGLER_FIG_STATUS
        assert "DataBridge" in STRANGLER_FIG_STATUS
        assert "Health Monitor" in STRANGLER_FIG_STATUS

    def test_valid_modes(self):
        valid_modes = {"v1-cron", "v2-supervisor", "dual"}
        for name, entry in STRANGLER_FIG_STATUS.items():
            assert entry["mode"] in valid_modes, f"{name} has invalid mode: {entry['mode']}"
            assert "description" in entry

    def test_get_strangler_fig_status_returns_summary(self):
        result = get_strangler_fig_status()
        assert "components" in result
        assert "progress_summary" in result
        assert result["components"] == STRANGLER_FIG_STATUS
        # 3 v2 components: Shadow Observer, DataBridge, Health Monitor
        assert "3/8" in result["progress_summary"]


# ---------------------------------------------------------------------------
# Endpoint-level tests
# ---------------------------------------------------------------------------


class TestSupervisorEndpoint:
    def test_returns_200_with_all_sections(self, client: TestClient, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
        response = client.get("/api/supervisor")
        assert response.status_code == 200
        data = response.json()
        assert "shadow_observer_events" in data
        assert "shadow_observer_events_error" in data
        assert "hold_points" in data
        assert "hold_points_error" in data
        assert "strangler_fig" in data
        assert "strangler_fig_error" in data
        assert "daemons" in data
        assert "daemons_error" in data

    def test_no_errors_when_db_available(self, client: TestClient, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/supervisor").json()
        assert data["shadow_observer_events_error"] is None
        assert data["hold_points_error"] is None
        assert data["strangler_fig_error"] is None
        assert data["daemons_error"] is None

    def test_shadow_observer_events_filtered(self, client: TestClient, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/supervisor").json()
        events = data["shadow_observer_events"]
        assert isinstance(events, list)
        assert len(events) > 0
        for event in events:
            assert event["source"] == "shadow_observer"

    def test_hold_points_returns_state(self, client: TestClient, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/supervisor").json()
        hold = data["hold_points"]
        assert hold["state"] in ("active", "paused")
        assert isinstance(hold["events"], list)

    def test_strangler_fig_has_components_and_summary(self, client: TestClient, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/supervisor").json()
        sf = data["strangler_fig"]
        assert "components" in sf
        assert "progress_summary" in sf
        assert len(sf["components"]) == 8

    def test_daemons_returns_latest_per_component(self, client: TestClient, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/supervisor").json()
        daemons = data["daemons"]
        assert isinstance(daemons, list)
        assert len(daemons) == 6

    def test_degraded_when_db_unavailable(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", "/nonexistent/path.db")
        response = client.get("/api/supervisor")
        assert response.status_code == 200
        data = response.json()
        # DB sections should have errors
        assert data["shadow_observer_events"] is None
        assert data["shadow_observer_events_error"] is not None
        assert data["hold_points"] is None
        assert data["hold_points_error"] is not None
        assert data["daemons"] is None
        assert data["daemons_error"] is not None
        # Strangler Fig is static config — still works
        assert data["strangler_fig"] is not None
        assert data["strangler_fig_error"] is None

    def test_independent_section_degradation(self, client: TestClient, supervisor_db_path: str, tmp_path, monkeypatch):
        """One section can fail while others succeed if the query itself errors."""
        # Corrupt the events table so shadow_observer and hold_point queries fail,
        # but health_checks (daemons) still works.
        import sqlite3 as _sqlite3
        corrupt_db = tmp_path / "partial.db"
        conn = _sqlite3.connect(str(corrupt_db))
        conn.row_factory = _sqlite3.Row
        # Create health_checks but NOT events table
        conn.execute(
            "CREATE TABLE health_checks (id INTEGER PRIMARY KEY, timestamp TEXT, component TEXT, status TEXT, details TEXT, created_at TEXT)"
        )
        conn.execute(
            "INSERT INTO health_checks (timestamp, component, status, details, created_at) VALUES ('2026-04-04T06:00:00Z', 'Scout', 'healthy', NULL, '2026-04-04T06:30:00Z')"
        )
        conn.commit()
        conn.close()
        monkeypatch.setattr("src.config.settings.supervisor_db_path", str(corrupt_db))
        data = client.get("/api/supervisor").json()
        # shadow_observer and hold_points fail (no events table)
        assert data["shadow_observer_events"] is None
        assert data["shadow_observer_events_error"] is not None
        assert data["hold_points"] is None
        assert data["hold_points_error"] is not None
        # daemons still works
        assert data["daemons"] is not None
        assert data["daemons_error"] is None
        assert len(data["daemons"]) == 1
        # strangler_fig always works (static config)
        assert data["strangler_fig"] is not None
        assert data["strangler_fig_error"] is None

    def test_degraded_when_db_path_empty(self, client: TestClient, monkeypatch):
        monkeypatch.setattr("src.config.settings.supervisor_db_path", "")
        response = client.get("/api/supervisor")
        assert response.status_code == 200
        data = response.json()
        assert data["shadow_observer_events"] is None
        assert "not configured" in data["shadow_observer_events_error"]
        # Strangler Fig still works
        assert data["strangler_fig"] is not None
