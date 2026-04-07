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

    Keys: scout_universe, scout_passed, guardian_approved, guardian_modified,
    guardian_rejected, michael_traded.
    """
    scout_universe = conn.execute(
        "SELECT COUNT(*) AS cnt FROM scout_candidates WHERE scan_date = ?",
        (scan_date,),
    ).fetchone()["cnt"]

    scout_passed = conn.execute(
        "SELECT COUNT(*) AS cnt FROM scout_candidates WHERE scan_date = ? AND passed_gates = 1",
        (scan_date,),
    ).fetchone()["cnt"]

    guardian_approved = conn.execute(
        "SELECT COUNT(*) AS cnt FROM guardian_decisions WHERE scan_date = ? AND decision = 'approve'",
        (scan_date,),
    ).fetchone()["cnt"]

    guardian_modified = conn.execute(
        "SELECT COUNT(*) AS cnt FROM guardian_decisions WHERE scan_date = ? AND decision = 'modify'",
        (scan_date,),
    ).fetchone()["cnt"]

    guardian_rejected = conn.execute(
        "SELECT COUNT(*) AS cnt FROM guardian_decisions WHERE scan_date = ? AND decision = 'reject'",
        (scan_date,),
    ).fetchone()["cnt"]

    michael_traded = conn.execute(
        "SELECT COUNT(DISTINCT ticker) AS cnt FROM trade_events WHERE scan_date = ?",
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
    """Return per-ticker stage and reason for the given scan_date.

    Combines data from scout_candidates (rejected), guardian_decisions,
    and trade_events to produce a list of dicts with ticker, stage, reason.

    A ticker may appear multiple times if it progressed through several
    stages (e.g. guardian_approved + traded). This is intentional —
    drilldown shows pipeline history.

    Note: stage counts are authoritative (from scout_candidates and
    guardian_decisions tables). Drilldown is best-effort — rejection_log
    may have fewer entries than the count of scout-rejected tickers.
    """
    results: list[dict] = []

    # Scout rejected: candidates that did NOT pass gates (and have a rejection_log entry)
    rows = conn.execute(
        """
        SELECT r.ticker, r.rejection_reason
        FROM rejection_log r
        WHERE r.scan_date = ? AND r.rejection_gate = 'scout'
        """,
        (scan_date,),
    ).fetchall()
    for row in rows:
        results.append({
            "ticker": row["ticker"],
            "stage": "scout_rejected",
            "reason": row["rejection_reason"],
        })

    # Guardian decisions (approve / modify / reject)
    rows = conn.execute(
        """
        SELECT ticker, decision
        FROM guardian_decisions
        WHERE scan_date = ?
        """,
        (scan_date,),
    ).fetchall()
    stage_map = {
        "approve": "guardian_approved",
        "modify": "guardian_modified",
        "reject": "guardian_rejected",
    }
    for row in rows:
        decision = row["decision"]
        if decision not in stage_map:
            logger.warning("Unknown guardian decision value: %s (ticker=%s)", decision, row["ticker"])
        results.append({
            "ticker": row["ticker"],
            "stage": stage_map.get(decision, f"guardian_{decision}"),
            "reason": decision,
        })

    # Traded tickers (one entry per ticker, using the first action)
    rows = conn.execute(
        """
        SELECT ticker, action
        FROM trade_events
        WHERE scan_date = ?
        GROUP BY ticker
        """,
        (scan_date,),
    ).fetchall()
    for row in rows:
        results.append({
            "ticker": row["ticker"],
            "stage": "traded",
            "reason": row["action"],
        })

    return results


def get_open_positions(conn: sqlite3.Connection) -> list[dict]:
    """Return all open positions from sim_positions with computed P&L and days_held.

    Queries sim_positions WHERE status='open' and computes:
    - unrealized_pnl: (current_price - entry_price) * shares
    - unrealized_pnl_pct: ((current_price - entry_price) / entry_price) * 100
    - days_held: days between entry_date and today

    Note: Schema is inferred from epics/PRD. Production column names may differ.
    """
    rows = conn.execute(
        """
        SELECT ticker, sector, entry_price, entry_date, current_price, shares,
               sleeve, stop_loss, target_1, target_2, conviction
        FROM sim_positions
        WHERE status = 'open'
        """,
    ).fetchall()

    today = date.today()
    positions: list[dict] = []
    for row in rows:
        entry_price = row["entry_price"]
        current_price = row["current_price"]
        shares = row["shares"]

        if entry_price is None or current_price is None or shares is None:
            logger.warning("NULL numeric column for ticker %s: entry_price=%s, current_price=%s, shares=%s",
                           row["ticker"], entry_price, current_price, shares)
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
            logger.warning("Invalid entry_date for ticker %s: %s", row["ticker"], row["entry_date"])
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


def get_portfolio_risk_data(conn: sqlite3.Connection) -> dict[str, dict]:
    """Return latest Guardian risk data per ticker from sim_portfolio_snapshots.

    Returns a dict keyed by ticker with risk fields:
    current_stop_level, exit_stage, portfolio_heat_contribution, sector_concentration_status.

    Uses the most recent snapshot_date per ticker. If no snapshot data exists,
    returns an empty dict (positions still display without risk overlay).
    """
    rows = conn.execute(
        """
        SELECT s.ticker, s.current_stop_level, s.exit_stage,
               s.portfolio_heat_contribution, s.sector_concentration_status
        FROM sim_portfolio_snapshots s
        INNER JOIN (
            SELECT ticker, MAX(snapshot_date) AS max_date
            FROM sim_portfolio_snapshots
            GROUP BY ticker
        ) latest ON s.ticker = latest.ticker AND s.snapshot_date = latest.max_date
        """,
    ).fetchall()

    risk_dict: dict[str, dict] = {}
    for row in rows:
        risk_dict[row["ticker"]] = {
            "current_stop_level": row["current_stop_level"],
            "exit_stage": row["exit_stage"],
            "portfolio_heat_contribution": row["portfolio_heat_contribution"],
            "sector_concentration_status": row["sector_concentration_status"],
        }

    return risk_dict


def get_portfolio_performance(conn: sqlite3.Connection) -> dict:
    """Return portfolio performance summary: P&L, CAGR, SPY return, alpha.

    Queries sim_portfolio_snapshots for aggregate portfolio_value and spy_value
    columns. Computes CAGR from first and latest snapshot dates.

    Returns dict with: total_pnl, total_pnl_pct, cagr, spy_return, alpha,
    start_date, end_date, total_trades.
    """
    # Get earliest and latest portfolio snapshots (aggregate rows)
    row = conn.execute(
        """
        SELECT MIN(snapshot_date) AS start_date, MAX(snapshot_date) AS end_date
        FROM sim_portfolio_snapshots
        WHERE portfolio_value IS NOT NULL AND ticker = '_PORTFOLIO'
        """
    ).fetchone()

    if row is None or row["start_date"] is None:
        return {
            "total_pnl": None,
            "total_pnl_pct": None,
            "cagr": None,
            "spy_return": None,
            "alpha": None,
            "start_date": None,
            "end_date": None,
            "total_trades": 0,
        }

    start_date = row["start_date"]
    end_date = row["end_date"]

    # Get start and end portfolio values
    start_row = conn.execute(
        """
        SELECT portfolio_value, spy_value
        FROM sim_portfolio_snapshots
        WHERE snapshot_date = ? AND portfolio_value IS NOT NULL AND ticker = '_PORTFOLIO'
        ORDER BY id ASC LIMIT 1
        """,
        (start_date,),
    ).fetchone()

    end_row = conn.execute(
        """
        SELECT portfolio_value, spy_value
        FROM sim_portfolio_snapshots
        WHERE snapshot_date = ? AND portfolio_value IS NOT NULL AND ticker = '_PORTFOLIO'
        ORDER BY id DESC LIMIT 1
        """,
        (end_date,),
    ).fetchone()

    if start_row is None or end_row is None:
        return {
            "total_pnl": None,
            "total_pnl_pct": None,
            "cagr": None,
            "spy_return": None,
            "alpha": None,
            "start_date": start_date,
            "end_date": end_date,
            "total_trades": 0,
        }

    start_value = start_row["portfolio_value"]
    end_value = end_row["portfolio_value"]
    start_spy = start_row["spy_value"]
    end_spy = end_row["spy_value"]

    # Compute P&L
    if start_value is not None and end_value is not None and start_value > 0:
        total_pnl = round(end_value - start_value, 2)
        total_pnl_pct = round(((end_value - start_value) / start_value) * 100, 2)
    else:
        total_pnl = None
        total_pnl_pct = None

    # Compute CAGR
    cagr = _compute_cagr(start_value, end_value, start_date, end_date)

    # Compute SPY return
    if start_spy is not None and end_spy is not None and start_spy > 0:
        spy_return = round(((end_spy - start_spy) / start_spy) * 100, 2)
    else:
        spy_return = None

    # Alpha = portfolio return - SPY return
    if total_pnl_pct is not None and spy_return is not None:
        alpha = round(total_pnl_pct - spy_return, 2)
    else:
        alpha = None

    # Total trades
    try:
        trade_count = conn.execute("SELECT COUNT(*) AS cnt FROM trade_events").fetchone()["cnt"]
    except Exception as exc:
        logger.warning("Could not query trade_events: %s", exc)
        trade_count = 0

    return {
        "total_pnl": total_pnl,
        "total_pnl_pct": total_pnl_pct,
        "cagr": cagr,
        "spy_return": spy_return,
        "alpha": alpha,
        "start_date": start_date,
        "end_date": end_date,
        "total_trades": trade_count,
    }


def get_portfolio_snapshots(conn: sqlite3.Connection) -> list[dict]:
    """Return time-series portfolio and SPY values for charting.

    Queries sim_portfolio_snapshots for _PORTFOLIO rows ordered by date.
    Returns list of dicts with snapshot_date, portfolio_value, spy_value.
    """
    rows = conn.execute(
        """
        SELECT snapshot_date, portfolio_value, spy_value
        FROM sim_portfolio_snapshots
        WHERE ticker = '_PORTFOLIO'
          AND portfolio_value IS NOT NULL
        ORDER BY snapshot_date ASC
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
    """Return recent guardian decisions with thesis and scoring inputs.

    Queries guardian_decisions for decisions ordered by scan_date DESC.
    Includes scoring columns (fundamental_score, ROIC, RSI, P/E, etc.)
    when available. Missing columns are returned as null.

    Args:
        conn: Read-only sqlite3 connection to portfolio.db.
        ticker: Optional ticker filter. If provided, returns all decisions
                for that ticker across all scan dates (no limit).
    """
    # Discover available columns to handle schema variations
    cursor = conn.execute("PRAGMA table_info(guardian_decisions)")
    available_cols = {row["name"] for row in cursor.fetchall()}

    # Core columns always expected
    core_cols = ["scan_date", "ticker", "decision"]

    # Extended columns from ACs — include if available
    extended_cols = [
        "conviction", "thesis_full_text", "primary_catalyst",
        "invalidation_trigger", "decision_tier",
        "fundamental_score", "roic_at_scan", "prev_roic", "roic_delta",
        "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
        "relative_strength", "valuation_verdict",
    ]

    # Fallback: use 'thesis' as thesis_full_text if column missing
    if "thesis_full_text" not in available_cols and "thesis" in available_cols:
        select_cols = core_cols + ["thesis AS thesis_full_text"]
        extended_cols.remove("thesis_full_text")
    else:
        select_cols = list(core_cols)

    for col in extended_cols:
        if col in available_cols:
            select_cols.append(col)

    select_sql = ", ".join(select_cols)

    if ticker is not None:
        rows = conn.execute(
            f"SELECT {select_sql} FROM guardian_decisions WHERE ticker = ? ORDER BY scan_date DESC",
            (ticker,),
        ).fetchall()
    else:
        rows = conn.execute(
            f"SELECT {select_sql} FROM guardian_decisions ORDER BY scan_date DESC LIMIT ?",
            (limit,),
        ).fetchall()

    # Build result dicts with all expected keys (null for missing columns)
    all_keys = core_cols + [
        "conviction", "thesis_full_text", "primary_catalyst",
        "invalidation_trigger", "decision_tier",
        "fundamental_score", "roic_at_scan", "prev_roic", "roic_delta",
        "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
        "relative_strength", "valuation_verdict",
    ]

    results = []
    for row in rows:
        row_dict = dict(row)
        entry = {}
        for key in all_keys:
            entry[key] = row_dict.get(key, None)
        results.append(entry)

    return results


def get_counterfactuals(conn: sqlite3.Connection, limit: int = 20) -> dict:
    """Return counterfactual analysis from rejection_log.

    Returns top missed opportunities (rejected tickers where forward return
    exceeded 10%) and top good rejections (forward return < 0%).

    If rejection_log lacks forward_return_pct column, returns empty lists.
    """
    # Check if forward_return_pct column exists
    cursor = conn.execute("PRAGMA table_info(rejection_log)")
    available_cols = {row["name"] for row in cursor.fetchall()}

    if "forward_return_pct" not in available_cols:
        logger.warning("rejection_log missing forward_return_pct column — returning empty counterfactuals")
        return {"top_misses": [], "top_good_rejections": []}

    # Top misses: rejected tickers with T+20 > 10%
    miss_rows = conn.execute(
        """
        SELECT ticker, scan_date, rejection_gate, rejection_reason, forward_return_pct
        FROM rejection_log
        WHERE forward_return_pct > 10.0
        ORDER BY forward_return_pct DESC
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

    # Top good rejections: rejected tickers with T+20 < 0%
    good_rows = conn.execute(
        """
        SELECT ticker, scan_date, rejection_gate, rejection_reason, forward_return_pct
        FROM rejection_log
        WHERE forward_return_pct < 0.0
        ORDER BY forward_return_pct ASC
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
