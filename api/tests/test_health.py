from unittest.mock import patch

from fastapi.testclient import TestClient

from src.main import app


client = TestClient(app)


class TestRootPing:
    def test_root_returns_ok(self):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


class TestHealthEndpointHappyPath:
    def test_returns_200_with_db(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "agents" in data
        assert "heartbeats" in data
        assert "vps_metrics" in data
        assert "alerts" in data

    def test_agents_list_has_six_agents(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        assert len(data["agents"]) == 6
        agent_names = {a["agent_name"] for a in data["agents"]}
        assert "Scout" in agent_names
        assert "Shadow Observer" in agent_names

    def test_heartbeats_keyed_by_agent(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        assert "Scout" in data["heartbeats"]
        assert data["heartbeats"]["Scout"]["status"] == "healthy"

    def test_vps_metrics_present(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        vps = data["vps_metrics"]
        assert "cpu_percent" in vps
        assert "memory_percent" in vps
        assert "disk_percent" in vps

    def test_alerts_returned(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        assert isinstance(data["alerts"], list)
        assert len(data["alerts"]) == 1
        assert data["alerts"][0]["source"] == "Guardian"


class TestHealthEndpointDegraded:
    def test_missing_db_returns_degraded(self, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", "")
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["agents"] is None
        assert "agents_error" in data
        assert data["heartbeats"] is None
        assert "heartbeats_error" in data
        assert data["alerts"] is None
        assert "alerts_error" in data
        # VPS metrics always available
        assert data["vps_metrics"] is not None
        assert "cpu_percent" in data["vps_metrics"]

    def test_nonexistent_db_file_returns_degraded(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "src.routers.health.settings.supervisor_db_path",
            str(tmp_path / "missing.db"),
        )
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["agents"] is None
        assert "agents_error" in data


class TestResponseShape:
    def test_no_envelope_wrapper(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        # No "data" or "success" envelope — direct fields
        assert "data" not in data
        assert "success" not in data

    def test_snake_case_keys(self, supervisor_db_path, monkeypatch):
        monkeypatch.setattr("src.routers.health.settings.supervisor_db_path", supervisor_db_path)
        data = client.get("/api/health").json()
        for key in data:
            assert key == key.lower(), f"Key {key} should be snake_case"
        vps = data["vps_metrics"]
        for key in vps:
            assert "_" in key or key.isalpha(), f"VPS key {key} should be snake_case"
