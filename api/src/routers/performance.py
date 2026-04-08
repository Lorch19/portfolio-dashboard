import logging
from typing import Optional

from fastapi import APIRouter, Query

from src.config import settings
from src.db.connection import get_db_connection
from src.db.portfolio import get_portfolio_performance, get_portfolio_snapshots
from src.db.supervisor import get_calibration_scores, get_prediction_accuracy

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_arena_comparison_from_portfolio(conn) -> list[dict]:
    """Query arena comparison from portfolio.db (arena_decisions + arena_forward_returns)."""
    rows = conn.execute(
        """
        SELECT
            ad.model_id,
            ad.session_id,
            COUNT(*) AS total_decisions,
            COALESCE(SUM(ad.cost_usd), 0) AS total_cost
        FROM arena_decisions ad
        GROUP BY ad.model_id, ad.session_id
        ORDER BY ad.session_id, ad.model_id
        """
    ).fetchall()

    results = []
    for row in rows:
        total = row["total_decisions"]
        # Get hit rate from arena_forward_returns
        hit_row = conn.execute(
            """
            SELECT COUNT(*) AS evaluated,
                   SUM(CASE WHEN t_plus_20 > 0 THEN 1 ELSE 0 END) AS hits,
                   AVG(t_plus_20) AS avg_alpha
            FROM arena_forward_returns afr
            JOIN arena_decisions ad ON afr.arena_decision_id = ad.id
            WHERE ad.model_id = ? AND ad.session_id = ?
              AND afr.t_plus_20 IS NOT NULL
            """,
            (row["model_id"], row["session_id"]),
        ).fetchone()

        evaluated = hit_row["evaluated"] or 0
        hits = hit_row["hits"] or 0

        results.append({
            "model_id": row["model_id"],
            "session": row["session_id"],
            "total_decisions": total,
            "hit_rate": round(hits / evaluated, 4) if evaluated > 0 else None,
            "average_alpha": round(hit_row["avg_alpha"], 4) if hit_row["avg_alpha"] is not None else None,
            "total_cost": round(row["total_cost"], 2) if row["total_cost"] else 0.0,
        })

    return results


def _get_strategy_comparison(conn, start_date: str | None = None, end_date: str | None = None) -> list[dict]:
    """Return per-strategy performance summary for multi-portfolio comparison."""
    where = ["total_value IS NOT NULL"]
    params: list[str] = []
    if start_date:
        where.append("date >= ?")
        params.append(start_date)
    if end_date:
        where.append("date <= ?")
        params.append(end_date)
    where_clause = " AND ".join(where)

    rows = conn.execute(
        f"""
        SELECT strategy_id,
               MIN(date) AS start_date,
               MAX(date) AS end_date
        FROM sim_portfolio_snapshots
        WHERE {where_clause}
        GROUP BY strategy_id
        ORDER BY strategy_id
        """,
        params,
    ).fetchall()

    results = []
    for row in rows:
        sid = row["strategy_id"]
        s_start = row["start_date"]
        s_end = row["end_date"]

        start_row = conn.execute(
            "SELECT total_value FROM sim_portfolio_snapshots WHERE date = ? AND strategy_id = ? AND total_value IS NOT NULL LIMIT 1",
            (s_start, sid),
        ).fetchone()

        end_row = conn.execute(
            "SELECT total_value, sp500_return_pct, alpha_pct, total_pnl_pct, win_rate, total_trades FROM sim_portfolio_snapshots WHERE date = ? AND strategy_id = ? AND total_value IS NOT NULL LIMIT 1",
            (s_end, sid),
        ).fetchone()

        if start_row is None or end_row is None:
            continue

        start_val = start_row["total_value"]
        end_val = end_row["total_value"]
        return_pct = end_row["total_pnl_pct"]
        if return_pct is None and start_val and start_val > 0:
            return_pct = round(((end_val - start_val) / start_val) * 100, 2)

        results.append({
            "strategy_id": sid,
            "start_date": s_start,
            "end_date": s_end,
            "start_value": start_val,
            "latest_value": end_val,
            "return_pct": round(return_pct, 2) if return_pct is not None else None,
            "spy_return_pct": round(end_row["sp500_return_pct"], 2) if end_row["sp500_return_pct"] is not None else None,
            "alpha_pct": round(end_row["alpha_pct"], 2) if end_row["alpha_pct"] is not None else None,
            "win_rate": round(end_row["win_rate"], 2) if end_row["win_rate"] is not None else None,
            "total_trades": end_row["total_trades"] or 0,
        })

    return results


def _query_performance(
    strategy_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Query portfolio and supervisor DBs for performance data."""
    result: dict = {"message": None}

    # --- Portfolio DB: portfolio summary + snapshots + arena + strategy comparison ---
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        for key in ["portfolio_summary", "snapshots", "arena_comparison", "strategy_comparison"]:
            result[key] = None
            result[f"{key}_error"] = "portfolio.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(portfolio_path)
        except Exception as exc:
            for key in ["portfolio_summary", "snapshots", "arena_comparison", "strategy_comparison"]:
                result[key] = None
                result[f"{key}_error"] = f"portfolio.db not accessible: {exc}"
            conn = None

        if conn is not None:
            try:
                try:
                    result["portfolio_summary"] = get_portfolio_performance(conn, strategy_id=strategy_id, start_date=start_date, end_date=end_date)
                    result["portfolio_summary_error"] = None
                except Exception as exc:
                    logger.exception("Error querying portfolio performance")
                    result["portfolio_summary"] = None
                    result["portfolio_summary_error"] = str(exc)

                try:
                    result["snapshots"] = get_portfolio_snapshots(conn, strategy_id=strategy_id, start_date=start_date, end_date=end_date)
                    result["snapshots_error"] = None
                except Exception as exc:
                    logger.exception("Error querying portfolio snapshots")
                    result["snapshots"] = None
                    result["snapshots_error"] = str(exc)

                try:
                    result["arena_comparison"] = _get_arena_comparison_from_portfolio(conn)
                    result["arena_comparison_error"] = None
                except Exception as exc:
                    logger.exception("Error querying arena comparison")
                    result["arena_comparison"] = None
                    result["arena_comparison_error"] = str(exc)

                try:
                    result["strategy_comparison"] = _get_strategy_comparison(conn, start_date=start_date, end_date=end_date)
                    result["strategy_comparison_error"] = None
                except Exception as exc:
                    logger.exception("Error querying strategy comparison")
                    result["strategy_comparison"] = None
                    result["strategy_comparison_error"] = str(exc)
            finally:
                conn.close()

    # --- Supervisor DB: prediction accuracy, calibration ---
    supervisor_path = settings.supervisor_db_path
    if not supervisor_path:
        sup_error = "michael_supervisor.db not accessible: path not configured"
        result["prediction_accuracy"] = None
        result["prediction_accuracy_error"] = sup_error
        result["calibration"] = None
        result["calibration_error"] = sup_error
    else:
        try:
            conn = get_db_connection(supervisor_path)
        except Exception as exc:
            sup_error = f"michael_supervisor.db not accessible: {exc}"
            result["prediction_accuracy"] = None
            result["prediction_accuracy_error"] = sup_error
            result["calibration"] = None
            result["calibration_error"] = sup_error
            conn = None

        if conn is not None:
            try:
                try:
                    result["prediction_accuracy"] = get_prediction_accuracy(conn)
                    result["prediction_accuracy_error"] = None
                except Exception as exc:
                    logger.exception("Error querying prediction accuracy")
                    result["prediction_accuracy"] = None
                    result["prediction_accuracy_error"] = str(exc)

                try:
                    result["calibration"] = get_calibration_scores(conn)
                    result["calibration_error"] = None
                except Exception as exc:
                    logger.exception("Error querying calibration scores")
                    result["calibration"] = None
                    result["calibration_error"] = str(exc)
            finally:
                conn.close()

    return result


@router.get("/api/performance")
def performance(
    strategy_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    return _query_performance(strategy_id=strategy_id, start_date=start_date, end_date=end_date)
