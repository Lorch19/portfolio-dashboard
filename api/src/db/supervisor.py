import sqlite3

EXPECTED_AGENTS = ["Chronicler", "Guardian", "Michael", "Radar", "Scout", "Shadow Observer"]


def get_agent_statuses(conn: sqlite3.Connection) -> list[dict]:
    """Get latest health check per agent from health_checks table.

    Returns one entry per expected agent. Agents with no rows in the DB
    are backfilled with null values. The ``last_run`` field reflects the
    most recent execution timestamp regardless of outcome (not filtered
    by success status — see AC1 interpretation note in review findings).
    """
    rows = conn.execute(
        """
        SELECT agent_name, status, last_run, details, checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY agent_name
        )
        ORDER BY agent_name
        """
    ).fetchall()
    found = {row["agent_name"]: dict(row) for row in rows}
    return [
        found.get(name, {"agent_name": name, "status": None, "last_run": None, "details": None, "checked_at": None})
        for name in EXPECTED_AGENTS
    ]


def get_heartbeat_status(conn: sqlite3.Connection) -> dict:
    """Get heartbeat summary: agent_name -> latest status and checked_at."""
    rows = conn.execute(
        """
        SELECT agent_name, status, checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY agent_name
        )
        ORDER BY agent_name
        """
    ).fetchall()
    return {row["agent_name"]: {"status": row["status"], "checked_at": row["checked_at"]} for row in rows}


def get_recent_alerts(conn: sqlite3.Connection, limit: int = 20) -> list[dict]:
    """Get recent alert events from events table."""
    rows = conn.execute(
        """
        SELECT id, source, event_type, data, created_at
        FROM events
        WHERE event_type = 'alert'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]
