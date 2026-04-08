import logging
import sqlite3

logger = logging.getLogger(__name__)


def get_brokerage_costs(
    conn: sqlite3.Connection,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Return per-trade brokerage fees and cumulative total.

    Real trade_events schema: timestamp (not scan_date), event_type (not action),
    entry_price (not price), estimated_cost_dollars, no shares column directly.
    """
    trades: list[dict] = []
    cumulative = 0.0

    where_clauses = []
    params: list[str] = []
    if start_date:
        where_clauses.append("timestamp >= ?")
        params.append(start_date)
    if end_date:
        where_clauses.append("timestamp <= ? || 'T23:59:59'")
        params.append(end_date)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    rows = conn.execute(
        f"""
        SELECT ticker, timestamp, event_type, entry_price, estimated_cost_dollars
        FROM trade_events
        {where_sql}
        ORDER BY timestamp DESC, ticker
        """,
        params,
    ).fetchall()

    for row in rows:
        cost = row["estimated_cost_dollars"] or 0.0
        cumulative += cost
        # Extract date from ISO timestamp
        trade_date = row["timestamp"][:10] if row["timestamp"] else None
        trades.append({
            "ticker": row["ticker"],
            "trade_date": trade_date,
            "action": row["event_type"],
            "shares": None,
            "price": row["entry_price"],
            "estimated_cost": round(cost, 2),
        })

    # Try realized_gains for additional transaction_costs (closed trades)
    realized_total = 0.0
    try:
        rg_rows = conn.execute(
            "SELECT COALESCE(SUM(transaction_costs), 0) AS total FROM realized_gains"
        ).fetchone()
        realized_total = rg_rows["total"] or 0.0
    except sqlite3.OperationalError:
        logger.debug("realized_gains table not found, skipping")

    return {
        "trades": trades,
        "cumulative_trade_event_fees": round(cumulative, 2),
        "cumulative_realized_fees": round(realized_total, 2),
        "cumulative_total": round(cumulative + realized_total, 2),
    }


def get_api_costs(
    conn: sqlite3.Connection,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Return API costs per model and cumulative from arena_decisions.

    Note: arena_decisions is in portfolio.db, not supervisor.db in the real system.
    """
    where_clauses = []
    params: list[str] = []
    if start_date:
        where_clauses.append("created_at >= ?")
        params.append(start_date)
    if end_date:
        where_clauses.append("created_at <= ? || 'T23:59:59'")
        params.append(end_date)

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    rows = conn.execute(
        f"""
        SELECT model_id,
               COUNT(*) AS total_decisions,
               COALESCE(SUM(cost_usd), 0) AS total_cost
        FROM arena_decisions
        {where_sql}
        GROUP BY model_id
        ORDER BY total_cost DESC
        """,
        params,
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

    Real schema: date (not snapshot_date), total_value (not portfolio_value),
    no ticker column (all rows are portfolio-level).
    """
    row = conn.execute(
        """
        SELECT MIN(date) AS start_date, MAX(date) AS end_date
        FROM sim_portfolio_snapshots
        WHERE total_value IS NOT NULL
        """
    ).fetchone()

    if row is None or row["start_date"] is None:
        return None

    start_date = row["start_date"]
    end_date = row["end_date"]

    start_row = conn.execute(
        "SELECT total_value FROM sim_portfolio_snapshots WHERE date = ? AND total_value IS NOT NULL ORDER BY rowid ASC LIMIT 1",
        (start_date,),
    ).fetchone()

    end_row = conn.execute(
        "SELECT total_value FROM sim_portfolio_snapshots WHERE date = ? AND total_value IS NOT NULL ORDER BY rowid DESC LIMIT 1",
        (end_date,),
    ).fetchone()

    if start_row is None or end_row is None:
        return None

    start_value = start_row["total_value"]
    end_value = end_row["total_value"]

    if start_value is None or end_value is None or start_value <= 0:
        return None

    total_return = round(end_value - start_value, 2)
    total_return_pct = round(((end_value - start_value) / start_value) * 100, 2)

    from datetime import date as date_type
    try:
        d1 = date_type.fromisoformat(start_date)
        d2 = date_type.fromisoformat(end_date)
        days = (d2 - d1).days
        months_running = max(days / 30.44, 1)
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
