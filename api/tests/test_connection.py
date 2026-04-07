import sqlite3

import pytest

from src.db.connection import get_db_connection, get_portfolio_db, get_supervisor_db


class TestGetDbConnection:
    def test_read_only_connection(self, supervisor_db_path: str):
        conn = get_db_connection(supervisor_db_path)
        try:
            rows = conn.execute("SELECT COUNT(*) FROM health_checks").fetchone()
            assert rows[0] == 6
        finally:
            conn.close()

    def test_write_blocked(self, supervisor_db_path: str):
        conn = get_db_connection(supervisor_db_path)
        try:
            with pytest.raises(sqlite3.OperationalError):
                conn.execute(
                    "INSERT INTO health_checks (component, status, created_at) "
                    "VALUES ('test', 'ok', '2026-01-01T00:00:00Z')"
                )
        finally:
            conn.close()

    def test_row_factory_set(self, supervisor_db_path: str):
        conn = get_db_connection(supervisor_db_path)
        try:
            row = conn.execute("SELECT component FROM health_checks LIMIT 1").fetchone()
            assert row["component"] == "Scout"
        finally:
            conn.close()

    def test_missing_db_file_raises(self, tmp_path):
        with pytest.raises(sqlite3.OperationalError):
            get_db_connection(str(tmp_path / "nonexistent.db"))


class TestGetSupervisorDb:
    def test_yields_connection(self, supervisor_db_path: str, monkeypatch):
        monkeypatch.setattr("src.db.connection.settings.supervisor_db_path", supervisor_db_path)
        gen = get_supervisor_db()
        conn = next(gen)
        assert isinstance(conn, sqlite3.Connection)
        try:
            gen.send(None)
        except StopIteration:
            pass

    def test_missing_path_raises(self, monkeypatch):
        monkeypatch.setattr("src.db.connection.settings.supervisor_db_path", "")
        gen = get_supervisor_db()
        with pytest.raises(FileNotFoundError):
            next(gen)

    def test_nonexistent_file_raises(self, monkeypatch, tmp_path):
        monkeypatch.setattr(
            "src.db.connection.settings.supervisor_db_path",
            str(tmp_path / "missing.db"),
        )
        gen = get_supervisor_db()
        with pytest.raises(FileNotFoundError):
            next(gen)


class TestGetPortfolioDB:
    def test_yields_connection(self, portfolio_db_path: str, monkeypatch):
        monkeypatch.setattr("src.db.connection.settings.portfolio_db_path", portfolio_db_path)
        gen = get_portfolio_db()
        conn = next(gen)
        assert isinstance(conn, sqlite3.Connection)
        try:
            gen.send(None)
        except StopIteration:
            pass

    def test_missing_path_raises(self, monkeypatch):
        monkeypatch.setattr("src.db.connection.settings.portfolio_db_path", "")
        gen = get_portfolio_db()
        with pytest.raises(FileNotFoundError):
            next(gen)
