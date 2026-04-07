import logging
import sqlite3

logger = logging.getLogger(__name__)


def get_raw_events(
    conn: sqlite3.Connection,
    source: str | None = None,
    event_type: str | None = None,
    since: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Return raw events from supervisor events table with optional filters.

    Args:
        conn: Read-only sqlite3 connection to michael_supervisor.db.
        source: Filter by event source (e.g. 'data_bridge', 'Guardian').
        event_type: Filter by event_type (e.g. 'sync_complete', 'alert').
        since: ISO date string — only events on or after this date.
        limit: Max rows to return (clamped to 500).
    """
    limit = min(limit, 500)

    conditions: list[str] = []
    params: list[str | int] = []

    if source:
        conditions.append("source = ?")
        params.append(source)
    if event_type:
        conditions.append("event_type = ?")
        params.append(event_type)
    if since:
        conditions.append("created_at >= ?")
        params.append(since)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    rows = conn.execute(
        f"SELECT id, source, event_type, data, created_at FROM events {where} ORDER BY created_at DESC LIMIT ?",
        [*params, limit],
    ).fetchall()

    return [
        {
            "id": row["id"],
            "source": row["source"],
            "event_type": row["event_type"],
            "payload": row["data"],
            "timestamp": row["created_at"],
        }
        for row in rows
    ]


def get_pipeline_replay(conn_portfolio: sqlite3.Connection, scan_date: str) -> dict:
    """Reconstruct a pipeline cycle for a given date from portfolio.db tables.

    Returns chronological steps: scout scan, guardian decisions, trade events,
    and portfolio snapshot (if available).
    """
    steps: list[dict] = []

    # 1. Scout scan
    scout_row = conn_portfolio.execute(
        "SELECT COUNT(*) AS total FROM scout_candidates WHERE scan_date = ?",
        (scan_date,),
    ).fetchone()
    scout_total = scout_row["total"]

    if scout_total == 0:
        return {"date": scan_date, "steps": [], "message": "No pipeline run found for this date"}

    scout_passed_row = conn_portfolio.execute(
        "SELECT COUNT(*) AS cnt FROM scout_candidates WHERE scan_date = ? AND passed_gates = 1",
        (scan_date,),
    ).fetchone()
    scout_passed = scout_passed_row["cnt"]

    top_tickers = conn_portfolio.execute(
        "SELECT ticker FROM scout_candidates WHERE scan_date = ? AND passed_gates = 1 LIMIT 10",
        (scan_date,),
    ).fetchall()

    steps.append({
        "step": "scout_scan",
        "label": "Scout Scan",
        "summary": f"{scout_total} candidates scanned, {scout_passed} passed gates",
        "detail": {
            "total_scanned": scout_total,
            "passed_gates": scout_passed,
            "top_tickers": [row["ticker"] for row in top_tickers],
        },
    })

    # 2. Guardian decisions
    guardian_rows = conn_portfolio.execute(
        "SELECT ticker, decision, conviction, thesis FROM guardian_decisions WHERE scan_date = ? ORDER BY ticker",
        (scan_date,),
    ).fetchall()

    approved = [r for r in guardian_rows if r["decision"] == "approve"]
    modified = [r for r in guardian_rows if r["decision"] == "modify"]
    rejected = [r for r in guardian_rows if r["decision"] == "reject"]

    guardian_detail = [
        {
            "ticker": row["ticker"],
            "decision": row["decision"],
            "conviction": row["conviction"],
            "thesis": row["thesis"],
        }
        for row in guardian_rows
    ]

    steps.append({
        "step": "guardian_decisions",
        "label": "Guardian Decisions",
        "summary": f"{len(approved)} approved, {len(modified)} modified, {len(rejected)} rejected",
        "detail": {
            "decisions": guardian_detail,
            "approved_count": len(approved),
            "modified_count": len(modified),
            "rejected_count": len(rejected),
        },
    })

    # 3. Trade events
    trade_rows = conn_portfolio.execute(
        "SELECT ticker, action, shares, price, created_at FROM trade_events WHERE scan_date = ? ORDER BY created_at",
        (scan_date,),
    ).fetchall()

    trade_detail = [
        {
            "ticker": row["ticker"],
            "action": row["action"],
            "shares": row["shares"],
            "price": row["price"],
            "timestamp": row["created_at"],
        }
        for row in trade_rows
    ]

    steps.append({
        "step": "trade_events",
        "label": "Trade Events",
        "summary": f"{len(trade_rows)} trades executed",
        "detail": {
            "trades": trade_detail,
        },
    })

    # 4. Portfolio snapshot (if exists)
    try:
        snap_row = conn_portfolio.execute(
            """
            SELECT portfolio_value, spy_value
            FROM sim_portfolio_snapshots
            WHERE snapshot_date = ? AND ticker = '_PORTFOLIO' AND portfolio_value IS NOT NULL
            LIMIT 1
            """,
            (scan_date,),
        ).fetchone()

        if snap_row:
            steps.append({
                "step": "portfolio_snapshot",
                "label": "Portfolio Snapshot",
                "summary": f"Portfolio value: ${snap_row['portfolio_value']:,.2f}" if snap_row["portfolio_value"] else "Snapshot recorded",
                "detail": {
                    "portfolio_value": snap_row["portfolio_value"],
                    "spy_value": snap_row["spy_value"],
                },
            })
    except Exception as exc:
        logger.warning("Could not query portfolio snapshot for replay: %s", exc)

    return {"date": scan_date, "steps": steps, "message": None}
