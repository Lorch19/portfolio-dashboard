import logging
import os
import time

import psutil
from fastapi import APIRouter

from src.db.connection import get_db_connection
from src.config import DB_STALENESS_MULTIPLIER, DB_SYNC_INTERVALS_SEC, settings
from src.db.supervisor import get_agent_statuses, get_heartbeat_status, get_recent_alerts

router = APIRouter()
logger = logging.getLogger(__name__)


def _check_db_freshness() -> list[dict]:
    """Report each configured DB's age against its expected launchd sync interval.

    Catches the failure mode where a DB path is misconfigured (e.g. pointed at a
    stale local file instead of the synced copy) or the sync agent silently stops
    working — both look fine from the app's perspective otherwise, since a stale
    SQLite file still opens and queries without error.
    """
    dbs = {
        "portfolio_db": settings.portfolio_db_path,
        "supervisor_db": settings.supervisor_db_path,
    }
    results = []
    for name, path in dbs.items():
        max_age = DB_SYNC_INTERVALS_SEC.get(name, 1800) * DB_STALENESS_MULTIPLIER
        entry = {"name": name, "path": path, "max_age_seconds": max_age}
        if not path or not os.path.exists(path):
            entry["status"] = "missing"
            entry["age_seconds"] = None
        else:
            age = time.time() - os.path.getmtime(path)
            entry["age_seconds"] = round(age, 1)
            entry["status"] = "stale" if age > max_age else "healthy"
        results.append(entry)
    return results


def _collect_vps_metrics() -> tuple[dict | None, str | None]:
    """Collect VPS metrics via psutil. Returns (metrics, error)."""
    try:
        return {
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_percent": psutil.disk_usage("/").percent,
        }, None
    except Exception as exc:
        logger.exception("Error collecting VPS metrics")
        return None, str(exc)


def _query_supervisor() -> tuple[list | None, dict | None, list | None, str | None]:
    """Query supervisor DB. Returns (agents, heartbeats, alerts, error)."""
    path = settings.supervisor_db_path
    if not path:
        return None, None, None, "michael_supervisor.db not accessible: path not configured"
    try:
        conn = get_db_connection(path)
    except Exception as exc:
        return None, None, None, f"michael_supervisor.db not accessible: {exc}"
    try:
        agents = get_agent_statuses(conn)
        heartbeats = get_heartbeat_status(conn)
        alerts = get_recent_alerts(conn)
        return agents, heartbeats, alerts, None
    except Exception as exc:
        logger.exception("Error querying supervisor DB")
        return None, None, None, f"michael_supervisor.db not accessible: {exc}"
    finally:
        conn.close()


@router.get("/api/health")
def health():
    agents, heartbeats, alerts, db_error = _query_supervisor()
    vps_metrics, vps_error = _collect_vps_metrics()

    result: dict = {
        "agents": agents,
        "agents_error": db_error,
        "heartbeats": heartbeats,
        "heartbeats_error": db_error,
        "alerts": alerts,
        "alerts_error": db_error,
        "vps_metrics": vps_metrics,
        "vps_metrics_error": vps_error,
        "db_freshness": _check_db_freshness(),
    }

    return result
