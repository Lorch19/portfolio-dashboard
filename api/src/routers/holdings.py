import logging

from fastapi import APIRouter

from src.config import settings
from src.db.connection import get_db_connection
from src.db.portfolio import get_open_positions, get_portfolio_risk_data

router = APIRouter()
logger = logging.getLogger(__name__)

DEFAULT_RISK_NULLS = {
    "current_stop_level": None,
    "exit_stage": None,
    "portfolio_heat_contribution": None,
    "sector_concentration_status": None,
}


def _query_holdings() -> dict:
    """Query portfolio DB for open positions and Guardian risk data.

    Each section is independently wrapped so partial failures produce
    _error strings instead of a 500 crash. Risk data is merged into
    position dicts; if risk query fails, positions still return with
    null risk fields.
    """
    path = settings.portfolio_db_path
    if not path:
        db_error = "portfolio.db not accessible: path not configured"
        return {
            "positions": None,
            "positions_error": db_error,
            "risk_data_error": db_error,
            "message": None,
        }

    try:
        conn = get_db_connection(path)
    except Exception as exc:
        db_error = f"portfolio.db not accessible: {exc}"
        return {
            "positions": None,
            "positions_error": db_error,
            "risk_data_error": db_error,
            "message": None,
        }

    result: dict = {"message": None}
    try:
        # Positions section
        try:
            positions = get_open_positions(conn)
            result["positions"] = positions
            result["positions_error"] = None
        except Exception as exc:
            logger.exception("Error querying open positions")
            positions = None
            result["positions"] = None
            result["positions_error"] = str(exc)

        # Risk data section
        risk_data: dict = {}
        try:
            risk_data = get_portfolio_risk_data(conn)
            result["risk_data_error"] = None
        except Exception as exc:
            logger.exception("Error querying portfolio risk data")
            result["risk_data_error"] = str(exc)

        # Merge risk data into positions
        if positions is not None:
            for pos in positions:
                ticker = pos["ticker"]
                pos.update(risk_data.get(ticker, dict(DEFAULT_RISK_NULLS)))

            if len(positions) == 0:
                result["message"] = "No open positions"
    finally:
        conn.close()

    return result


@router.get("/api/holdings")
def holdings():
    return _query_holdings()
