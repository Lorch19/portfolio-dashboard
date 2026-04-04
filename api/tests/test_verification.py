import time

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


class TestRootAndHealthCoexist:
    def test_root_ping_still_works(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}

    def test_health_endpoint_exists(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200


class TestHealthResponseShape:
    def test_all_required_fields_present_happy(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        assert "agents" in data
        assert "heartbeats" in data
        assert "vps_metrics" in data
        assert "alerts" in data
        # Agents have required structure
        for agent in data["agents"]:
            assert "agent_name" in agent
            assert "status" in agent
            assert "last_run" in agent
            assert "checked_at" in agent

    def test_all_required_fields_present_degraded(self, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", "")
        data = client.get("/api/health").json()
        assert data["agents"] is None
        assert "agents_error" in data
        assert data["heartbeats"] is None
        assert "heartbeats_error" in data
        assert data["alerts"] is None
        assert "alerts_error" in data
        assert data["vps_metrics"] is not None


class TestResponseTime:
    def test_under_500ms(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        start = time.monotonic()
        resp = client.get("/api/health")
        elapsed_ms = (time.monotonic() - start) * 1000
        assert resp.status_code == 200
        assert elapsed_ms < 500, f"Response took {elapsed_ms:.0f}ms, exceeds 500ms threshold"

    def test_under_500ms_degraded(self, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", "")
        start = time.monotonic()
        resp = client.get("/api/health")
        elapsed_ms = (time.monotonic() - start) * 1000
        assert resp.status_code == 200
        assert elapsed_ms < 500, f"Response took {elapsed_ms:.0f}ms, exceeds 500ms threshold"
