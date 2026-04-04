import logging

import psutil
from fastapi import APIRouter

from src.db.connection import get_db_connection
from src.config import settings
from src.db.supervisor import get_agent_statuses, get_heartbeat_status, get_recent_alerts

router = APIRouter()
logger = logging.getLogger(__name__)


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
    }

    return result
