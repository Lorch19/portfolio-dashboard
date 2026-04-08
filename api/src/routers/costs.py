import logging
from typing import Optional

from fastapi import APIRouter, Query

from src.config import VPS_MONTHLY_COST, settings
from src.db.connection import get_db_connection
from src.db.costs import get_brokerage_costs, get_total_portfolio_return

router = APIRouter()
logger = logging.getLogger(__name__)


def _query_costs(start_date: str | None = None, end_date: str | None = None, strategy_id: str | None = None) -> dict:
    """Query portfolio and supervisor DBs for cost data.

    Each section is independently wrapped so partial failures produce
    _error strings instead of a 500 crash.
    """
    result: dict = {"message": None}

    brokerage: dict | None = None
    portfolio_return: dict | None = None

    # --- Portfolio DB: brokerage costs + portfolio return ---
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        result["brokerage"] = None
        result["brokerage_error"] = "portfolio.db not accessible: path not configured"
        result["portfolio_return"] = None
        result["portfolio_return_error"] = "portfolio.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(portfolio_path)
        except Exception as exc:
            result["brokerage"] = None
            result["brokerage_error"] = f"portfolio.db not accessible: {exc}"
            result["portfolio_return"] = None
            result["portfolio_return_error"] = f"portfolio.db not accessible: {exc}"
            conn = None

        if conn is not None:
            try:
                try:
                    brokerage = get_brokerage_costs(conn, start_date=start_date, end_date=end_date)
                    result["brokerage"] = brokerage
                    result["brokerage_error"] = None
                except Exception as exc:
                    logger.exception("Error querying brokerage costs")
                    result["brokerage"] = None
                    result["brokerage_error"] = str(exc)

                try:
                    portfolio_return = get_total_portfolio_return(conn, strategy_id=strategy_id)
                    result["portfolio_return"] = portfolio_return
                    result["portfolio_return_error"] = None
                except Exception as exc:
                    logger.exception("Error querying portfolio return")
                    result["portfolio_return"] = None
                    result["portfolio_return_error"] = str(exc)
            finally:
                conn.close()

    # --- Portfolio DB: API costs from arena_decisions (in portfolio.db) ---
    api_costs: dict | None = None
    if not portfolio_path:
        result["api_costs"] = None
        result["api_costs_error"] = "portfolio.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(portfolio_path)
        except Exception as exc:
            result["api_costs"] = None
            result["api_costs_error"] = f"portfolio.db not accessible: {exc}"
            conn = None

        if conn is not None:
            try:
                from src.db.costs import get_api_costs
                api_costs = get_api_costs(conn, start_date=start_date, end_date=end_date)
                result["api_costs"] = api_costs
                result["api_costs_error"] = None
            except Exception as exc:
                logger.exception("Error querying API costs")
                result["api_costs"] = None
                result["api_costs_error"] = str(exc)
            finally:
                conn.close()

    # --- VPS cost (config constant) ---
    result["vps_monthly_cost"] = VPS_MONTHLY_COST

    # --- Compute total system cost and ROI ---
    brokerage_total = brokerage["cumulative_total"] if brokerage else 0.0
    api_total = api_costs["cumulative_total"] if api_costs else 0.0

    months = portfolio_return["months_running"] if portfolio_return else 1
    vps_total = round(VPS_MONTHLY_COST * months, 2)

    total_system_cost = round(brokerage_total + api_total + vps_total, 2)

    # Cost per trade
    trade_count = len(brokerage["trades"]) if brokerage else 0
    cost_per_trade = round(total_system_cost / trade_count, 2) if trade_count > 0 else None

    result["vps_cumulative"] = vps_total
    result["total_system_cost"] = total_system_cost
    result["cost_per_trade"] = cost_per_trade
    result["total_trades"] = trade_count

    # ROI metrics
    if portfolio_return and portfolio_return["total_return"] is not None:
        net_return = round(portfolio_return["total_return"] - total_system_cost, 2)
        cost_as_pct_of_returns = (
            round((total_system_cost / portfolio_return["total_return"]) * 100, 2)
            if portfolio_return["total_return"] > 0 else None
        )
        result["net_return_after_costs"] = net_return
        result["cost_as_pct_of_returns"] = cost_as_pct_of_returns
    else:
        result["net_return_after_costs"] = None
        result["cost_as_pct_of_returns"] = None

    return result


@router.get("/api/costs")
def costs(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    strategy_id: Optional[str] = Query(None),
):
    return _query_costs(start_date=start_date, end_date=end_date, strategy_id=strategy_id)
