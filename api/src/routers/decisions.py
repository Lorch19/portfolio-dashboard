import logging

from fastapi import APIRouter, Query

from src.config import settings
from src.db.connection import get_db_connection
from src.db.portfolio import get_counterfactuals, get_recent_decisions
from src.db.supervisor import get_decision_predictions

router = APIRouter()
logger = logging.getLogger(__name__)


def _query_decisions(ticker: str | None = None) -> dict:
    """Query portfolio and supervisor DBs for decisions data.

    Each section is independently wrapped so partial failures produce
    _error strings instead of a 500 crash. Portfolio and supervisor DB
    connections are opened and closed independently.
    """
    result: dict = {"message": None}

    # --- Portfolio DB: decisions + counterfactuals ---
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        result["decisions"] = None
        result["decisions_error"] = "portfolio.db not accessible: path not configured"
        result["counterfactuals"] = None
        result["counterfactuals_error"] = "portfolio.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(portfolio_path)
        except Exception as exc:
            result["decisions"] = None
            result["decisions_error"] = f"portfolio.db not accessible: {exc}"
            result["counterfactuals"] = None
            result["counterfactuals_error"] = f"portfolio.db not accessible: {exc}"
            conn = None

        if conn is not None:
            try:
                try:
                    result["decisions"] = get_recent_decisions(conn, ticker=ticker)
                    result["decisions_error"] = None
                except Exception as exc:
                    logger.exception("Error querying decisions")
                    result["decisions"] = None
                    result["decisions_error"] = str(exc)

                try:
                    result["counterfactuals"] = get_counterfactuals(conn)
                    result["counterfactuals_error"] = None
                except Exception as exc:
                    logger.exception("Error querying counterfactuals")
                    result["counterfactuals"] = None
                    result["counterfactuals_error"] = str(exc)
            finally:
                conn.close()

    # --- Supervisor DB: predictions ---
    supervisor_path = settings.supervisor_db_path
    if not supervisor_path:
        result["predictions"] = None
        result["predictions_error"] = "michael_supervisor.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(supervisor_path)
        except Exception as exc:
            result["predictions"] = None
            result["predictions_error"] = f"michael_supervisor.db not accessible: {exc}"
            conn = None

        if conn is not None:
            try:
                try:
                    # If ticker filter is active, pass it to predictions query
                    tickers = [ticker] if ticker else None
                    result["predictions"] = get_decision_predictions(conn, tickers=tickers)
                    result["predictions_error"] = None
                except Exception as exc:
                    logger.exception("Error querying decision predictions")
                    result["predictions"] = None
                    result["predictions_error"] = str(exc)
            finally:
                conn.close()

    return result


@router.get("/api/decisions")
def decisions(ticker: str | None = Query(None, min_length=1)):
    return _query_decisions(ticker=ticker)
