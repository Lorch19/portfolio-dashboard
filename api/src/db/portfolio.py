import logging
import math
import sqlite3
from datetime import date

logger = logging.getLogger(__name__)


def get_latest_scan_date(conn: sqlite3.Connection) -> str | None:
    """Return the most recent scan_date from scout_candidates, or None if empty."""
    row = conn.execute("SELECT MAX(scan_date) AS latest FROM scout_candidates").fetchone()
    return row["latest"]


def get_funnel_counts(conn: sqlite3.Connection, scan_date: str) -> dict:
    """Return stage counts for the given scan_date.

    Real schema: scout_candidates has was_traded (bool), status columns.
    guardian_decisions uses decision_date (not scan_date).
    rejection_log uses rejected_at_gate (not rejection_gate).
    trade_events uses timestamp and event_type (not scan_date and action).
    """
    scout_universe = conn.execute(
        "SELECT COUNT(*) AS cnt FROM scout_candidates WHERE scan_date = ?",
        (scan_date,),
    ).fetchone()["cnt"]

    # Scout "passed" = candidates not in rejection_log for this date
    # Count distinct tickers rejected (not total rejection rows — one ticker can fail multiple gates)
    scout_rejected_tickers = conn.execute(
        "SELECT COUNT(DISTINCT ticker) AS cnt FROM rejection_log WHERE scan_date = ?",
        (scan_date,),
    ).fetchone()["cnt"]
    scout_passed = max(scout_universe - scout_rejected_tickers, 0)

    guardian_approved = conn.execute(
        "SELECT COUNT(*) AS cnt FROM guardian_decisions WHERE decision_date = ? AND decision = 'approve'",
        (scan_date,),
    ).fetchone()["cnt"]

    guardian_modified = conn.execute(
        "SELECT COUNT(*) AS cnt FROM guardian_decisions WHERE decision_date = ? AND decision = 'modify'",
        (scan_date,),
    ).fetchone()["cnt"]

    guardian_rejected = conn.execute(
        "SELECT COUNT(*) AS cnt FROM guardian_decisions WHERE decision_date = ? AND decision = 'reject'",
        (scan_date,),
    ).fetchone()["cnt"]

    # trade_events: timestamp is ISO datetime, match by date prefix
    michael_traded = conn.execute(
        "SELECT COUNT(DISTINCT ticker) AS cnt FROM trade_events WHERE timestamp LIKE ? || '%'",
        (scan_date,),
    ).fetchone()["cnt"]

    return {
        "scout_universe": scout_universe,
        "scout_passed": scout_passed,
        "guardian_approved": guardian_approved,
        "guardian_modified": guardian_modified,
        "guardian_rejected": guardian_rejected,
        "michael_traded": michael_traded,
    }


def get_funnel_drilldown(conn: sqlite3.Connection, scan_date: str) -> list[dict]:
    """Return per-ticker stage and reason for the given scan_date."""
    results: list[dict] = []

    # Rejections: rejected_at_gate (not rejection_gate)
    rows = conn.execute(
        """
        SELECT ticker, rejection_reason
        FROM rejection_log
        WHERE scan_date = ?
        """,
        (scan_date,),
    ).fetchall()
    for row in rows:
        results.append({
            "ticker": row["ticker"],
            "stage": "scout_rejected",
            "reason": row["rejection_reason"],
        })

    # Guardian decisions (decision_date, not scan_date)
    rows = conn.execute(
        "SELECT ticker, decision FROM guardian_decisions WHERE decision_date = ?",
        (scan_date,),
    ).fetchall()
    stage_map = {
        "approve": "guardian_approved",
        "modify": "guardian_modified",
        "reject": "guardian_rejected",
    }
    for row in rows:
        decision = row["decision"]
        results.append({
            "ticker": row["ticker"],
            "stage": stage_map.get(decision, f"guardian_{decision}"),
            "reason": decision,
        })

    # Traded tickers (timestamp is ISO datetime)
    rows = conn.execute(
        """
        SELECT ticker, event_type
        FROM trade_events
        WHERE timestamp LIKE ? || '%'
        GROUP BY ticker
        """,
        (scan_date,),
    ).fetchall()
    for row in rows:
        results.append({
            "ticker": row["ticker"],
            "stage": "traded",
            "reason": row["event_type"],
        })

    return results


def get_open_positions(conn: sqlite3.Connection) -> list[dict]:
    """Return all open positions from sim_positions with computed P&L and days_held.

    Real schema: id, trade_event_id, ticker, sector, entry_price, entry_date,
    shares, stop_loss, target_1, target_2, conviction (int), status, peak_price, sleeve.
    No current_price column — use peak_price as best available.
    """
    rows = conn.execute(
        """
        SELECT ticker, sector, entry_price, entry_date, peak_price, shares,
               sleeve, stop_loss, target_1, target_2, conviction
        FROM sim_positions
        WHERE status = 'open'
        """,
    ).fetchall()

    today = date.today()
    positions: list[dict] = []
    for row in rows:
        entry_price = row["entry_price"]
        current_price = row["peak_price"]  # best approximation
        shares = row["shares"]

        if entry_price is None or current_price is None or shares is None:
            unrealized_pnl = None
            unrealized_pnl_pct = None
        else:
            unrealized_pnl = round((current_price - entry_price) * shares, 2)
            if entry_price != 0:
                unrealized_pnl_pct = round(((current_price - entry_price) / entry_price) * 100, 2)
            else:
                unrealized_pnl_pct = None

        try:
            entry_date = date.fromisoformat(row["entry_date"])
            days_held = (today - entry_date).days
        except (ValueError, TypeError):
            days_held = None

        positions.append({
            "ticker": row["ticker"],
            "sector": row["sector"],
            "entry_price": entry_price,
            "entry_date": row["entry_date"],
            "current_price": current_price,
            "shares": shares,
            "unrealized_pnl": unrealized_pnl,
            "unrealized_pnl_pct": unrealized_pnl_pct,
            "sleeve": row["sleeve"],
            "stop_loss": row["stop_loss"],
            "target_1": row["target_1"],
            "target_2": row["target_2"],
            "conviction": row["conviction"],
            "days_held": days_held,
        })

    return positions


def get_portfolio_summary(conn: sqlite3.Connection) -> dict | None:
    """Return latest portfolio summary from sim_portfolio_snapshots.

    Returns: total_value, cash, cash_pct, invested_pct, positions_count,
    portfolio_heat, regime, date.
    """
    row = conn.execute(
        """
        SELECT date, total_value, cash, cash_pct, invested_pct, positions_count,
               portfolio_heat, regime, win_rate, total_trades, closed_trades
        FROM sim_portfolio_snapshots
        WHERE total_value IS NOT NULL
        ORDER BY date DESC
        LIMIT 1
        """
    ).fetchone()

    if row is None:
        return None

    return {
        "date": row["date"],
        "total_value": row["total_value"],
        "cash": row["cash"],
        "cash_pct": round(row["cash_pct"], 1) if row["cash_pct"] is not None else None,
        "invested_pct": round(row["invested_pct"], 1) if row["invested_pct"] is not None else None,
        "positions_count": row["positions_count"],
        "portfolio_heat": round(row["portfolio_heat"], 2) if row["portfolio_heat"] is not None else None,
        "regime": row["regime"],
        "win_rate": round(row["win_rate"], 2) if row["win_rate"] is not None else None,
        "total_trades": row["total_trades"],
        "closed_trades": row["closed_trades"],
    }


def get_portfolio_risk_data(conn: sqlite3.Connection) -> dict[str, dict]:
    """Return Guardian risk data per ticker.

    Real sim_portfolio_snapshots doesn't have per-ticker risk data.
    It has portfolio-level snapshots with positions_json containing per-position data.
    Return empty dict — positions display without risk overlay.
    """
    return {}


def get_portfolio_performance(conn: sqlite3.Connection) -> dict:
    """Return portfolio performance summary.

    Real schema: date, strategy_id, total_value, sp500_return_pct, alpha_pct,
    total_pnl_pct, win_rate, total_trades, closed_trades.
    """
    row = conn.execute(
        """
        SELECT MIN(date) AS start_date, MAX(date) AS end_date
        FROM sim_portfolio_snapshots
        WHERE total_value IS NOT NULL
        """
    ).fetchone()

    if row is None or row["start_date"] is None:
        return {
            "total_pnl": None, "total_pnl_pct": None, "cagr": None,
            "spy_return": None, "alpha": None,
            "start_date": None, "end_date": None, "total_trades": 0,
        }

    start_date = row["start_date"]
    end_date = row["end_date"]

    start_row = conn.execute(
        "SELECT total_value FROM sim_portfolio_snapshots WHERE date = ? AND total_value IS NOT NULL ORDER BY rowid ASC LIMIT 1",
        (start_date,),
    ).fetchone()

    end_row = conn.execute(
        "SELECT total_value, sp500_return_pct, alpha_pct, total_pnl_pct, total_trades FROM sim_portfolio_snapshots WHERE date = ? AND total_value IS NOT NULL ORDER BY rowid DESC LIMIT 1",
        (end_date,),
    ).fetchone()

    if start_row is None or end_row is None:
        return {
            "total_pnl": None, "total_pnl_pct": None, "cagr": None,
            "spy_return": None, "alpha": None,
            "start_date": start_date, "end_date": end_date, "total_trades": 0,
        }

    start_value = start_row["total_value"]
    end_value = end_row["total_value"]

    # Use direct columns if available
    total_pnl_pct = end_row["total_pnl_pct"]
    spy_return = end_row["sp500_return_pct"]
    alpha = end_row["alpha_pct"]
    total_trades = end_row["total_trades"] or 0

    # Compute P&L from values
    if start_value is not None and end_value is not None and start_value > 0:
        total_pnl = round(end_value - start_value, 2)
        if total_pnl_pct is None:
            total_pnl_pct = round(((end_value - start_value) / start_value) * 100, 2)
    else:
        total_pnl = None

    cagr = _compute_cagr(start_value, end_value, start_date, end_date)

    # Win rate and closed trades from latest snapshot
    win_rate = end_row["win_rate"] if "win_rate" in end_row.keys() else None
    closed_trades = end_row["closed_trades"] if "closed_trades" in end_row.keys() else None

    return {
        "total_pnl": total_pnl,
        "total_pnl_pct": round(total_pnl_pct, 2) if total_pnl_pct is not None else None,
        "cagr": cagr,
        "spy_return": round(spy_return, 2) if spy_return is not None else None,
        "alpha": round(alpha, 2) if alpha is not None else None,
        "start_date": start_date,
        "end_date": end_date,
        "total_trades": total_trades,
        "win_rate": round(win_rate, 2) if win_rate is not None else None,
        "closed_trades": closed_trades,
    }


def get_portfolio_snapshots(conn: sqlite3.Connection) -> list[dict]:
    """Return time-series portfolio values for charting.

    Real schema: date, total_value, sp500_return_pct (percentage, not SPY value).
    """
    rows = conn.execute(
        """
        SELECT date AS snapshot_date, total_value AS portfolio_value, sp500_return_pct AS spy_value
        FROM sim_portfolio_snapshots
        WHERE total_value IS NOT NULL
        ORDER BY date ASC
        """,
    ).fetchall()

    return [
        {
            "snapshot_date": row["snapshot_date"],
            "portfolio_value": row["portfolio_value"],
            "spy_value": row["spy_value"],
        }
        for row in rows
    ]


def get_recent_decisions(
    conn: sqlite3.Connection, ticker: str | None = None, limit: int = 50,
) -> list[dict]:
    """Return recent decisions with scoring inputs.

    Tries guardian_decisions first. If empty (common — pipeline may skip that table),
    falls back to trade_events as the primary decision record.
    Enriches with scout_candidates scoring data.
    """
    all_keys = [
        "scan_date", "ticker", "decision", "conviction",
        "thesis_full_text", "primary_catalyst", "invalidation_trigger", "decision_tier",
        "fundamental_score", "roic_at_scan", "prev_roic", "roic_delta",
        "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
        "relative_strength", "valuation_verdict",
    ]

    # Try guardian_decisions first
    rows = []
    try:
        count = conn.execute("SELECT COUNT(*) AS cnt FROM guardian_decisions").fetchone()["cnt"]
        if count > 0:
            if ticker is not None:
                rows = conn.execute(
                    "SELECT decision_date AS scan_date, ticker, decision, proposed_conviction AS conviction FROM guardian_decisions WHERE ticker = ? ORDER BY decision_date DESC",
                    (ticker,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT decision_date AS scan_date, ticker, decision, proposed_conviction AS conviction FROM guardian_decisions ORDER BY decision_date DESC LIMIT ?",
                    (limit,),
                ).fetchall()
    except Exception:
        pass

    # Fallback: use trade_events as decision records
    if not rows:
        try:
            if ticker is not None:
                rows = conn.execute(
                    """
                    SELECT substr(timestamp, 1, 10) AS scan_date, ticker, event_type AS decision,
                           conviction, thesis_full_text, primary_catalyst,
                           invalidation_trigger, decision_tier
                    FROM trade_events
                    WHERE ticker = ?
                    ORDER BY timestamp DESC
                    """,
                    (ticker,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT substr(timestamp, 1, 10) AS scan_date, ticker, event_type AS decision,
                           conviction, thesis_full_text, primary_catalyst,
                           invalidation_trigger, decision_tier
                    FROM trade_events
                    ORDER BY timestamp DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
        except Exception:
            pass

    # Build scoring lookup from scout_candidates
    scoring_map: dict[str, dict] = {}
    try:
        scoring_rows = conn.execute(
            """
            SELECT ticker, scan_date, fundamental_score, roic_at_scan, prev_roic, roic_delta,
                   rsi, pe_at_scan, median_pe, pe_discount_pct, relative_strength, valuation_verdict
            FROM scout_candidates
            WHERE fundamental_score IS NOT NULL
            ORDER BY scan_date DESC
            """
        ).fetchall()
        for sr in scoring_rows:
            key = sr["ticker"]
            if key not in scoring_map:
                scoring_map[key] = dict(sr)
    except Exception:
        pass

    results = []
    for row in rows:
        row_dict = dict(row)
        entry = {}
        for key in all_keys:
            entry[key] = row_dict.get(key, None)

        # Merge scoring from scout_candidates
        scoring = scoring_map.get(row_dict["ticker"], {})
        for k in ["fundamental_score", "roic_at_scan", "prev_roic", "roic_delta",
                   "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
                   "relative_strength", "valuation_verdict"]:
            if entry[k] is None:
                entry[k] = scoring.get(k)

        results.append(entry)

    return results


def get_counterfactuals(conn: sqlite3.Connection, limit: int = 20) -> dict:
    """Return counterfactual analysis from rejection_log.

    Real schema: t_plus_20 (not forward_return_pct).
    """
    cursor = conn.execute("PRAGMA table_info(rejection_log)")
    available_cols = {row["name"] for row in cursor.fetchall()}

    if "t_plus_20" not in available_cols:
        logger.warning("rejection_log missing t_plus_20 column — returning empty counterfactuals")
        return {"top_misses": [], "top_good_rejections": []}

    # Top misses: rejected tickers with T+20 > 10%
    miss_rows = conn.execute(
        """
        SELECT ticker, scan_date, rejected_at_gate AS rejection_gate,
               rejection_reason, t_plus_20 AS forward_return_pct
        FROM rejection_log
        WHERE t_plus_20 > 10.0
        ORDER BY t_plus_20 DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    top_misses = [
        {
            "ticker": row["ticker"],
            "scan_date": row["scan_date"],
            "rejection_gate": row["rejection_gate"],
            "rejection_reason": row["rejection_reason"],
            "forward_return_pct": round(row["forward_return_pct"], 2),
        }
        for row in miss_rows
    ]

    # Top good rejections: T+20 < 0%
    good_rows = conn.execute(
        """
        SELECT ticker, scan_date, rejected_at_gate AS rejection_gate,
               rejection_reason, t_plus_20 AS forward_return_pct
        FROM rejection_log
        WHERE t_plus_20 < 0.0
        ORDER BY t_plus_20 ASC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()

    top_good_rejections = [
        {
            "ticker": row["ticker"],
            "scan_date": row["scan_date"],
            "rejection_gate": row["rejection_gate"],
            "rejection_reason": row["rejection_reason"],
            "forward_return_pct": round(row["forward_return_pct"], 2),
        }
        for row in good_rows
    ]

    return {
        "top_misses": top_misses,
        "top_good_rejections": top_good_rejections,
    }


def _compute_cagr(
    start_value: float | None, end_value: float | None,
    start_date: str, end_date: str,
) -> float | None:
    """CAGR = (end/start)^(365/days) - 1, returned as percentage."""
    if start_value is None or end_value is None or start_value <= 0 or end_value <= 0:
        return None
    try:
        d1 = date.fromisoformat(start_date)
        d2 = date.fromisoformat(end_date)
        days = (d2 - d1).days
        if days < 7:
            return None
        cagr = (math.pow(end_value / start_value, 365 / days) - 1) * 100
        return round(cagr, 2)
    except (ValueError, TypeError):
        return None
