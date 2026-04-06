import logging
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
