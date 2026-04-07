import logging

from fastapi import APIRouter

from src.config import settings
from src.db.connection import get_db_connection
from src.db.portfolio import get_portfolio_performance
from src.db.supervisor import get_arena_comparison, get_calibration_scores, get_prediction_accuracy

router = APIRouter()
logger = logging.getLogger(__name__)


def _query_performance() -> dict:
    """Query portfolio and supervisor DBs for performance data.

    Each section is independently wrapped so partial failures produce
    _error strings instead of a 500 crash. Portfolio and supervisor DB
    connections are opened and closed independently.
    """
    result: dict = {"message": None}

    # --- Portfolio DB: portfolio summary ---
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        result["portfolio_summary"] = None
        result["portfolio_summary_error"] = "portfolio.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(portfolio_path)
        except Exception as exc:
            result["portfolio_summary"] = None
            result["portfolio_summary_error"] = f"portfolio.db not accessible: {exc}"
            conn = None

        if conn is not None:
            try:
                try:
                    result["portfolio_summary"] = get_portfolio_performance(conn)
                    result["portfolio_summary_error"] = None
                except Exception as exc:
                    logger.exception("Error querying portfolio performance")
                    result["portfolio_summary"] = None
                    result["portfolio_summary_error"] = str(exc)
            finally:
                conn.close()

    # --- Supervisor DB: prediction accuracy, calibration, arena ---
    supervisor_path = settings.supervisor_db_path
    if not supervisor_path:
        sup_error = "michael_supervisor.db not accessible: path not configured"
        result["prediction_accuracy"] = None
        result["prediction_accuracy_error"] = sup_error
        result["calibration"] = None
        result["calibration_error"] = sup_error
        result["arena_comparison"] = None
        result["arena_comparison_error"] = sup_error
    else:
        try:
            conn = get_db_connection(supervisor_path)
        except Exception as exc:
            sup_error = f"michael_supervisor.db not accessible: {exc}"
            result["prediction_accuracy"] = None
            result["prediction_accuracy_error"] = sup_error
            result["calibration"] = None
            result["calibration_error"] = sup_error
            result["arena_comparison"] = None
            result["arena_comparison_error"] = sup_error
            conn = None

        if conn is not None:
            try:
                # Prediction accuracy section
                try:
                    result["prediction_accuracy"] = get_prediction_accuracy(conn)
                    result["prediction_accuracy_error"] = None
                except Exception as exc:
                    logger.exception("Error querying prediction accuracy")
                    result["prediction_accuracy"] = None
                    result["prediction_accuracy_error"] = str(exc)

                # Calibration section
                try:
                    result["calibration"] = get_calibration_scores(conn)
                    result["calibration_error"] = None
                except Exception as exc:
                    logger.exception("Error querying calibration scores")
                    result["calibration"] = None
                    result["calibration_error"] = str(exc)

                # Arena comparison section
                try:
                    result["arena_comparison"] = get_arena_comparison(conn)
                    result["arena_comparison_error"] = None
                except Exception as exc:
                    logger.exception("Error querying arena comparison")
                    result["arena_comparison"] = None
                    result["arena_comparison_error"] = str(exc)
            finally:
                conn.close()

    return result


@router.get("/api/performance")
def performance():
    return _query_performance()
