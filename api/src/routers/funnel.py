import logging

from fastapi import APIRouter

from src.config import settings
from src.db.connection import get_db_connection
from src.db.portfolio import get_funnel_counts, get_funnel_drilldown, get_latest_scan_date

router = APIRouter()
logger = logging.getLogger(__name__)


def _query_funnel_sections(scan_date: str) -> dict:
    """Query portfolio DB for funnel stage counts and drilldown.

    Each section is independently wrapped so partial failures produce
    _error strings instead of a 500 crash.
    """
    path = settings.portfolio_db_path
    if not path:
        db_error = "portfolio.db not accessible: path not configured"
        return {
            "scan_date": scan_date,
            "stages": None,
            "stages_error": db_error,
            "drilldown": None,
            "drilldown_error": db_error,
            "message": None,
        }

    try:
        conn = get_db_connection(path)
    except Exception as exc:
        db_error = f"portfolio.db not accessible: {exc}"
        return {
            "scan_date": scan_date,
            "stages": None,
            "stages_error": db_error,
            "drilldown": None,
            "drilldown_error": db_error,
            "message": None,
        }

    result: dict = {"scan_date": scan_date, "message": None}
    try:
        # Resolve scan_date if not provided
        if not scan_date:
            try:
                scan_date = get_latest_scan_date(conn)
            except Exception as exc:
                logger.exception("Error querying latest scan date")
                db_error = f"Failed to resolve latest scan date: {exc}"
                return {
                    "scan_date": None,
                    "stages": None,
                    "stages_error": db_error,
                    "drilldown": None,
                    "drilldown_error": db_error,
                    "message": None,
                }
            if scan_date is None:
                return {
                    "scan_date": None,
                    "stages": {
                        "scout_universe": 0,
                        "scout_passed": 0,
                        "guardian_approved": 0,
                        "guardian_modified": 0,
                        "guardian_rejected": 0,
                        "michael_traded": 0,
                    },
                    "stages_error": None,
                    "drilldown": [],
                    "drilldown_error": None,
                    "message": "No funnel data available",
                }
            result["scan_date"] = scan_date

        # Stages section
        try:
            counts = get_funnel_counts(conn, scan_date)
            result["stages"] = counts
            result["stages_error"] = None
            # Check if all counts are zero → no data message
            if all(v == 0 for v in counts.values()):
                result["message"] = f"No funnel data for {scan_date}"
        except Exception as exc:
            logger.exception("Error querying funnel counts")
            result["stages"] = None
            result["stages_error"] = str(exc)

        # Drilldown section
        try:
            result["drilldown"] = get_funnel_drilldown(conn, scan_date)
            result["drilldown_error"] = None
        except Exception as exc:
            logger.exception("Error querying funnel drilldown")
            result["drilldown"] = None
            result["drilldown_error"] = str(exc)
    finally:
        conn.close()

    return result


@router.get("/api/funnel")
def funnel(scan_date: str | None = None):
    return _query_funnel_sections(scan_date or "")
