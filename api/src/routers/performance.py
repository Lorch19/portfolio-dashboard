import logging

from fastapi import APIRouter

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


def _query_performance() -> dict:
    """Query portfolio and supervisor DBs for performance data."""
    result: dict = {"message": None}

    # --- Portfolio DB: portfolio summary + snapshots + arena ---
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        for key in ["portfolio_summary", "snapshots", "arena_comparison"]:
            result[key] = None
            result[f"{key}_error"] = "portfolio.db not accessible: path not configured"
    else:
        try:
            conn = get_db_connection(portfolio_path)
        except Exception as exc:
            for key in ["portfolio_summary", "snapshots", "arena_comparison"]:
                result[key] = None
                result[f"{key}_error"] = f"portfolio.db not accessible: {exc}"
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

                try:
                    result["snapshots"] = get_portfolio_snapshots(conn)
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
def performance():
    return _query_performance()
