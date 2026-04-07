import logging
import sqlite3

logger = logging.getLogger(__name__)


def get_brokerage_costs(conn: sqlite3.Connection) -> dict:
    """Return per-trade brokerage fees and cumulative total.

    Sources:
    - trade_events.estimated_cost_dollars for all trades
    - realized_gains.transaction_costs for closed trades (if table exists)

    Returns dict with: trades (list of per-trade dicts), cumulative_fees.
    """
    trades: list[dict] = []
    cumulative = 0.0

    # Per-trade costs from trade_events
    rows = conn.execute(
        """
        SELECT ticker, scan_date, action, shares, price, estimated_cost_dollars
        FROM trade_events
        ORDER BY scan_date DESC, ticker
        """
    ).fetchall()

    for row in rows:
        cost = row["estimated_cost_dollars"] or 0.0
        cumulative += cost
        trades.append({
            "ticker": row["ticker"],
            "trade_date": row["scan_date"],
            "action": row["action"],
            "shares": row["shares"],
            "price": row["price"],
            "estimated_cost": round(cost, 2),
        })

    # Try realized_gains for additional transaction_costs (closed trades)
    realized_total = 0.0
    try:
        rg_rows = conn.execute(
            """
            SELECT COALESCE(SUM(transaction_costs), 0) AS total
            FROM realized_gains
            """
        ).fetchone()
        realized_total = rg_rows["total"] or 0.0
    except sqlite3.OperationalError:
        # Table doesn't exist yet — graceful degradation
        logger.debug("realized_gains table not found, skipping")

    return {
        "trades": trades,
        "cumulative_trade_event_fees": round(cumulative, 2),
        "cumulative_realized_fees": round(realized_total, 2),
        "cumulative_total": round(cumulative + realized_total, 2),
    }


def get_api_costs(conn: sqlite3.Connection) -> dict:
    """Return API costs per model and cumulative from arena_decisions.

    Returns dict with: per_model (list of dicts), cumulative_total.
    """
    rows = conn.execute(
        """
        SELECT model_id,
               COUNT(*) AS total_decisions,
               COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM arena_decisions
        GROUP BY model_id
        ORDER BY total_cost DESC
        """
    ).fetchall()

    per_model: list[dict] = []
    cumulative = 0.0
    for row in rows:
        cost = row["total_cost"] or 0.0
        cumulative += cost
        per_model.append({
            "model_id": row["model_id"],
            "total_decisions": row["total_decisions"],
            "total_cost": round(cost, 2),
        })

    return {
        "per_model": per_model,
        "cumulative_total": round(cumulative, 2),
    }


def get_total_portfolio_return(conn: sqlite3.Connection) -> dict | None:
    """Return total portfolio return from sim_portfolio_snapshots.

    Returns dict with: start_value, end_value, total_return, total_return_pct,
    start_date, end_date, months_running.
    Returns None if no snapshot data.
    """
    row = conn.execute(
        """
        SELECT MIN(snapshot_date) AS start_date, MAX(snapshot_date) AS end_date
        FROM sim_portfolio_snapshots
        WHERE portfolio_value IS NOT NULL AND ticker = '_PORTFOLIO'
        """
    ).fetchone()

    if row is None or row["start_date"] is None:
        return None

    start_date = row["start_date"]
    end_date = row["end_date"]

    start_row = conn.execute(
        """
        SELECT portfolio_value
        FROM sim_portfolio_snapshots
        WHERE snapshot_date = ? AND ticker = '_PORTFOLIO' AND portfolio_value IS NOT NULL
        ORDER BY id ASC LIMIT 1
        """,
        (start_date,),
    ).fetchone()

    end_row = conn.execute(
        """
        SELECT portfolio_value
        FROM sim_portfolio_snapshots
        WHERE snapshot_date = ? AND ticker = '_PORTFOLIO' AND portfolio_value IS NOT NULL
        ORDER BY id DESC LIMIT 1
        """,
        (end_date,),
    ).fetchone()

    if start_row is None or end_row is None:
        return None

    start_value = start_row["portfolio_value"]
    end_value = end_row["portfolio_value"]

    if start_value is None or end_value is None or start_value <= 0:
        return None

    total_return = round(end_value - start_value, 2)
    total_return_pct = round(((end_value - start_value) / start_value) * 100, 2)

    # Compute months running (approximate)
    from datetime import date as date_type
    try:
        d1 = date_type.fromisoformat(start_date)
        d2 = date_type.fromisoformat(end_date)
        days = (d2 - d1).days
        months_running = max(days / 30.44, 1)  # At least 1 month
    except (ValueError, TypeError):
        months_running = 1

    return {
        "start_value": start_value,
        "end_value": end_value,
        "total_return": total_return,
        "total_return_pct": total_return_pct,
        "start_date": start_date,
        "end_date": end_date,
        "months_running": round(months_running, 1),
    }
