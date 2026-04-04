import sqlite3

from tests.conftest import SUPERVISOR_SAMPLE_DATA, SUPERVISOR_SCHEMA
from src.db.supervisor import get_agent_statuses, get_heartbeat_status, get_recent_alerts


def _create_in_memory_db() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SUPERVISOR_SCHEMA)
    conn.executescript(SUPERVISOR_SAMPLE_DATA)
    return conn


class TestGetAgentStatuses:
    def test_returns_all_agents(self):
        conn = _create_in_memory_db()
        statuses = get_agent_statuses(conn)
        agent_names = {s["agent_name"] for s in statuses}
        assert agent_names == {"Scout", "Radar", "Guardian", "Chronicler", "Michael", "Shadow Observer"}
        conn.close()

    def test_returns_dict_format(self):
        conn = _create_in_memory_db()
        statuses = get_agent_statuses(conn)
        for s in statuses:
            assert "agent_name" in s
            assert "status" in s
            assert "last_run" in s
            assert "checked_at" in s
        conn.close()

    def test_returns_latest_entry_per_agent(self):
        conn = _create_in_memory_db()
        # Insert a newer entry for Scout
        conn.execute(
            "INSERT INTO health_checks (agent_name, status, last_run, details, checked_at) "
            "VALUES ('Scout', 'degraded', '2026-04-04T07:00:00Z', NULL, '2026-04-04T07:30:00Z')"
        )
        statuses = get_agent_statuses(conn)
        scout = next(s for s in statuses if s["agent_name"] == "Scout")
        assert scout["status"] == "degraded"
        conn.close()


class TestGetHeartbeatStatus:
    def test_returns_dict_keyed_by_agent(self):
        conn = _create_in_memory_db()
        heartbeats = get_heartbeat_status(conn)
        assert "Scout" in heartbeats
        assert "Chronicler" in heartbeats
        assert heartbeats["Scout"]["status"] == "healthy"
        assert heartbeats["Chronicler"]["status"] == "degraded"
        conn.close()

    def test_includes_checked_at(self):
        conn = _create_in_memory_db()
        heartbeats = get_heartbeat_status(conn)
        for agent, data in heartbeats.items():
            assert "checked_at" in data
        conn.close()


class TestGetRecentAlerts:
    def test_returns_only_alerts(self):
        conn = _create_in_memory_db()
        alerts = get_recent_alerts(conn)
        assert len(alerts) == 1
        assert alerts[0]["event_type"] == "alert"
        assert alerts[0]["source"] == "Guardian"
        conn.close()

    def test_respects_limit(self):
        conn = _create_in_memory_db()
        # Add more alert events
        for i in range(5):
            conn.execute(
                "INSERT INTO events (source, event_type, data, created_at) "
                f"VALUES ('Scout', 'alert', NULL, '2026-04-04T07:0{i}:00Z')"
            )
        alerts = get_recent_alerts(conn, limit=3)
        assert len(alerts) == 3
        conn.close()

    def test_ordered_by_created_at_desc(self):
        conn = _create_in_memory_db()
        conn.execute(
            "INSERT INTO events (source, event_type, data, created_at) "
            "VALUES ('Radar', 'alert', NULL, '2026-04-04T08:00:00Z')"
        )
        alerts = get_recent_alerts(conn)
        assert alerts[0]["created_at"] == "2026-04-04T08:00:00Z"
        conn.close()
