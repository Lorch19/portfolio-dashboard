import logging

from fastapi import APIRouter

from src.config import settings, get_strangler_fig_status
from src.db.connection import get_db_connection
from src.db.supervisor import get_shadow_observer_events, get_hold_point_status, get_daemon_status

router = APIRouter()
logger = logging.getLogger(__name__)


def _query_supervisor_sections() -> dict:
    """Query supervisor DB for all supervisor-tab sections.

    Each section is independently wrapped so partial failures produce
    _error strings instead of a 500 crash.
    """
    path = settings.supervisor_db_path
    if not path:
        db_error = "michael_supervisor.db not accessible: path not configured"
        return {
            "shadow_observer_events": None,
            "shadow_observer_events_error": db_error,
            "hold_points": None,
            "hold_points_error": db_error,
            "daemons": None,
            "daemons_error": db_error,
        }

    try:
        conn = get_db_connection(path)
    except Exception as exc:
        db_error = f"michael_supervisor.db not accessible: {exc}"
        return {
            "shadow_observer_events": None,
            "shadow_observer_events_error": db_error,
            "hold_points": None,
            "hold_points_error": db_error,
            "daemons": None,
            "daemons_error": db_error,
        }

    result: dict = {}
    try:
        # Shadow Observer events
        try:
            result["shadow_observer_events"] = get_shadow_observer_events(conn)
            result["shadow_observer_events_error"] = None
        except Exception as exc:
            logger.exception("Error querying shadow observer events")
            result["shadow_observer_events"] = None
            result["shadow_observer_events_error"] = str(exc)

        # Hold points
        try:
            result["hold_points"] = get_hold_point_status(conn)
            result["hold_points_error"] = None
        except Exception as exc:
            logger.exception("Error querying hold point status")
            result["hold_points"] = None
            result["hold_points_error"] = str(exc)

        # Daemon status
        try:
            result["daemons"] = get_daemon_status(conn)
            result["daemons_error"] = None
        except Exception as exc:
            logger.exception("Error querying daemon status")
            result["daemons"] = None
            result["daemons_error"] = str(exc)
    finally:
        conn.close()

    return result


@router.get("/api/supervisor")
def supervisor():
    # DB-backed sections (each independently error-handled)
    result = _query_supervisor_sections()

    # Strangler Fig — static config, no DB call
    try:
        result["strangler_fig"] = get_strangler_fig_status()
        result["strangler_fig_error"] = None
    except Exception as exc:
        logger.exception("Error reading Strangler Fig config")
        result["strangler_fig"] = None
        result["strangler_fig_error"] = str(exc)

    return result
