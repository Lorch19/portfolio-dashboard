import logging

import psutil
from fastapi import APIRouter

from src.db.connection import get_db_connection
from src.config import settings
from src.db.supervisor import get_agent_statuses, get_heartbeat_status, get_recent_alerts

router = APIRouter()
logger = logging.getLogger(__name__)


def _collect_vps_metrics() -> dict:
    return {
        "cpu_percent": psutil.cpu_percent(interval=0.1),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_percent": psutil.disk_usage("/").percent,
    }


def _query_supervisor() -> tuple[list | None, dict | None, list | None, str | None]:
    """Query supervisor DB. Returns (agents, heartbeats, alerts, error)."""
    path = settings.supervisor_db_path
    if not path:
        return None, None, None, "supervisor_db_path not configured"
    try:
        conn = get_db_connection(path)
    except Exception as exc:
        return None, None, None, str(exc)
    try:
        agents = get_agent_statuses(conn)
        heartbeats = get_heartbeat_status(conn)
        alerts = get_recent_alerts(conn)
        return agents, heartbeats, alerts, None
    except Exception as exc:
        logger.exception("Error querying supervisor DB")
        return None, None, None, str(exc)
    finally:
        conn.close()


@router.get("/api/health")
def health():
    agents, heartbeats, alerts, db_error = _query_supervisor()

    result: dict = {}

    if db_error:
        result["agents"] = None
        result["agents_error"] = db_error
        result["heartbeats"] = None
        result["heartbeats_error"] = db_error
        result["alerts"] = None
        result["alerts_error"] = db_error
    else:
        result["agents"] = agents
        result["heartbeats"] = heartbeats
        result["alerts"] = alerts

    result["vps_metrics"] = _collect_vps_metrics()

    return result
