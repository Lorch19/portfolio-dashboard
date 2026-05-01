import logging

from fastapi import APIRouter

from src.config import settings
from src.db import live_state as _live_state
from src.db.connection import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/strategies")
def strategies():
    """Return all strategies with summary metrics."""
    path = settings.portfolio_db_path
    if not path:
        return {"strategies": [], "error": "portfolio.db not configured"}

    try:
        conn = get_db_connection(path)
    except Exception as exc:
        return {"strategies": [], "error": str(exc)}

    try:
        rows = conn.execute(
            """
            SELECT
                s.strategy_id,
                MIN(s.date) AS snapshot_start_date,
                MAX(s.date) AS latest_snapshot_date,
                (SELECT total_value FROM sim_portfolio_snapshots s2
                 WHERE s2.strategy_id = s.strategy_id
                 ORDER BY s2.date DESC LIMIT 1) AS latest_value,
                (SELECT COUNT(*) FROM sim_positions
                 WHERE strategy_id = s.strategy_id AND status = 'open') AS open_positions,
                (SELECT MIN(entry_date) FROM sim_positions
                 WHERE strategy_id = s.strategy_id) AS first_entry_date
            FROM sim_portfolio_snapshots s
            WHERE total_value IS NOT NULL
            GROUP BY s.strategy_id
            ORDER BY s.strategy_id
            """
        ).fetchall()

        return {
            "strategies": [
                {
                    "strategy_id": row["strategy_id"],
                    "start_date": min(
                        d for d in (row["snapshot_start_date"], row["first_entry_date"]) if d
                    ),
                    "latest_snapshot_date": row["latest_snapshot_date"],
                    "latest_value": row["latest_value"],
                    "open_positions": row["open_positions"],
                }
                for row in rows
            ],
            "error": None,
        }
    except Exception as exc:
        logger.exception("Error querying strategies")
        return {"strategies": [], "error": str(exc)}
    finally:
        conn.close()


@router.post("/api/cache/clear")
def clear_cache():
    """Flush the live-state batch cache. Call after any strategy/variant change."""
    _live_state._batch_cache.clear()
    return {"cleared": True}
