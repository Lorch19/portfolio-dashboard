import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Query

from src.config import settings
from src.db import live_state
from src.db.connection import get_db_connection
from src.db.portfolio import (
    _count_trades,
    get_portfolio_performance,
    get_portfolio_snapshots,
    get_spy_return_for_range,
)
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


def _get_strategy_comparison(
    conn,
    portfolio_db_path: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Return per-strategy performance summary for multi-portfolio comparison.

    Uses live state (SimPortfolio.get_state) for current values and sim_positions
    for entry dates. Falls back to snapshot table only if live state is unavailable.
    """
    today = datetime.now().strftime("%Y-%m-%d")
    is_filtered = bool(start_date or end_date)

    strategy_ids = live_state.get_active_strategy_ids(portfolio_db_path)
    if not strategy_ids:
        # Fall back to strategies seen in snapshots
        snap_rows = conn.execute(
            "SELECT DISTINCT strategy_id FROM sim_portfolio_snapshots ORDER BY strategy_id"
        ).fetchall()
        strategy_ids = [r["strategy_id"] for r in snap_rows]

    results = []
    for sid in strategy_ids:
        state = live_state.get_live_strategy_state(sid, portfolio_db_path)

        if state is None:
            # Live state unavailable — fall back to last snapshot
            snap_end = conn.execute(
                "SELECT date, total_value FROM sim_portfolio_snapshots "
                "WHERE strategy_id = ? AND total_value IS NOT NULL "
                "ORDER BY date DESC LIMIT 1",
                (sid,),
            ).fetchone()
            if snap_end is None:
                continue
            end_val = float(snap_end["total_value"])
            s_end = snap_end["date"]
            s_start = None
        else:
            end_val = state["total_value"]
            s_end = today
            s_start = state["entry_date"]

        # Start date fallback: use snapshot earliest if no entry_date
        if s_start is None:
            snap_start = conn.execute(
                "SELECT MIN(date) AS d FROM sim_portfolio_snapshots WHERE strategy_id = ?",
                (sid,),
            ).fetchone()
            if snap_start and snap_start["d"]:
                s_start = snap_start["d"]
            else:
                continue

        # Override with user filters
        if start_date:
            s_start = start_date
        if end_date:
            s_end = end_date

        # Start value: $100K baseline if using entry_date (matches Telegram); else snapshot
        if not is_filtered:
            start_val = live_state.STARTING_CAPITAL
        else:
            snap_start_val = conn.execute(
                """
                SELECT total_value FROM sim_portfolio_snapshots
                WHERE strategy_id = ? AND date >= ? AND total_value IS NOT NULL
                ORDER BY date ASC LIMIT 1
                """,
                (sid, s_start),
            ).fetchone()
            start_val = float(snap_start_val["total_value"]) if snap_start_val else live_state.STARTING_CAPITAL

            # If end_date doesn't reach today, pull end from snapshot instead of live
            if end_date and end_date < today:
                snap_end_val = conn.execute(
                    """
                    SELECT total_value FROM sim_portfolio_snapshots
                    WHERE strategy_id = ? AND date <= ? AND total_value IS NOT NULL
                    ORDER BY date DESC LIMIT 1
                    """,
                    (sid, end_date),
                ).fetchone()
                if snap_end_val:
                    end_val = float(snap_end_val["total_value"])

        return_pct = round(((end_val - start_val) / start_val) * 100, 2) if start_val > 0 else None

        spy_return_pct = get_spy_return_for_range(s_start, s_end)
        alpha_pct = round(return_pct - spy_return_pct, 2) if return_pct is not None and spy_return_pct is not None else None

        trades = _count_trades(conn, sid, start_date if is_filtered else None, end_date if is_filtered else None)

        results.append({
            "strategy_id": sid,
            "start_date": s_start,
            "end_date": s_end,
            "start_value": start_val,
            "latest_value": end_val,
            "return_pct": return_pct,
            "spy_return_pct": spy_return_pct,
            "alpha_pct": alpha_pct,
            "win_rate": trades["win_rate"],
            "total_trades": trades["total_trades"],
            "positions_count": state["positions_count"] if state else None,
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
                    result["portfolio_summary"] = get_portfolio_performance(
                        conn,
                        strategy_id=strategy_id,
                        start_date=start_date,
                        end_date=end_date,
                        portfolio_db_path=portfolio_path,
                    )
                    result["portfolio_summary_error"] = None
                except Exception as exc:
                    logger.exception("Error querying portfolio performance")
                    result["portfolio_summary"] = None
                    result["portfolio_summary_error"] = str(exc)

                try:
                    result["snapshots"] = get_portfolio_snapshots(
                        conn,
                        strategy_id=strategy_id,
                        start_date=start_date,
                        end_date=end_date,
                        portfolio_db_path=portfolio_path,
                    )
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
                    result["strategy_comparison"] = _get_strategy_comparison(
                        conn,
                        portfolio_db_path=portfolio_path,
                        start_date=start_date,
                        end_date=end_date,
                    )
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
