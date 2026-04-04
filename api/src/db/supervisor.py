import sqlite3


def get_agent_statuses(conn: sqlite3.Connection) -> list[dict]:
    """Get latest health check per agent from health_checks table."""
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
    return [dict(row) for row in rows]


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
