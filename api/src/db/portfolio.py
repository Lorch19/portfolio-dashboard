import logging
import math
import sqlite3
from datetime import date

logger = logging.getLogger(__name__)


def _get_table_columns(conn: sqlite3.Connection, table_name: str) -> set[str]:
    """Return the set of column names for a table using PRAGMA."""
    cursor = conn.execute(f"PRAGMA table_info({table_name})")
    return {row["name"] for row in cursor.fetchall()}


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


def get_open_positions(conn: sqlite3.Connection, strategy_id: str | None = None) -> list[dict]:
    """Return open positions from sim_positions with computed P&L and days_held.

    Real schema includes strategy_id, current_price, peak_price.
    Uses current_price when available, falls back to peak_price.
    """
    # Check if current_price column exists (migration 21)
    cols = {row["name"] for row in conn.execute("PRAGMA table_info(sim_positions)").fetchall()}
    price_expr = "COALESCE(current_price, peak_price)" if "current_price" in cols else "peak_price"
    strat_filter = "AND strategy_id = ?" if strategy_id and "strategy_id" in cols else ""
    params: tuple = (strategy_id,) if strat_filter else ()

    rows = conn.execute(
        f"""
        SELECT ticker, sector, entry_price, entry_date,
               {price_expr} AS peak_price, shares,
               sleeve, stop_loss, target_1, target_2, conviction
        FROM sim_positions
        WHERE status = 'open' {strat_filter}
        """,
        params,
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


def get_portfolio_summary(conn: sqlite3.Connection, strategy_id: str | None = None) -> dict | None:
    """Return latest portfolio summary from sim_portfolio_snapshots.

    Returns: total_value, cash, cash_pct, invested_pct, positions_count,
    portfolio_heat, regime, date.
    """
    if strategy_id:
        row = conn.execute(
            """
            SELECT date, total_value, cash, cash_pct, invested_pct, positions_count,
                   portfolio_heat, regime, win_rate, total_trades, closed_trades
            FROM sim_portfolio_snapshots
            WHERE total_value IS NOT NULL AND strategy_id = ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (strategy_id,),
        ).fetchone()
    else:
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


def get_portfolio_performance(
    conn: sqlite3.Connection,
    strategy_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> dict:
    """Return portfolio performance summary.

    Real schema: date, strategy_id, total_value, sp500_return_pct, alpha_pct,
    total_pnl_pct, win_rate, total_trades, closed_trades.
    """
    where = ["total_value IS NOT NULL"]
    params: list[str] = []
    if strategy_id:
        where.append("strategy_id = ?")
        params.append(strategy_id)
    if start_date:
        where.append("date >= ?")
        params.append(start_date)
    if end_date:
        where.append("date <= ?")
        params.append(end_date)

    where_clause = " AND ".join(where)

    row = conn.execute(
        f"""
        SELECT MIN(date) AS start_date, MAX(date) AS end_date
        FROM sim_portfolio_snapshots
        WHERE {where_clause}
        """,
        params,
    ).fetchone()

    if row is None or row["start_date"] is None:
        return {
            "total_pnl": None, "total_pnl_pct": None, "cagr": None,
            "spy_return": None, "alpha": None,
            "start_date": None, "end_date": None, "total_trades": 0,
        }

    resolved_start = row["start_date"]
    resolved_end = row["end_date"]

    start_row = conn.execute(
        f"SELECT total_value FROM sim_portfolio_snapshots WHERE date = ? AND {where_clause} ORDER BY rowid ASC LIMIT 1",
        (resolved_start, *params),
    ).fetchone()

    end_row = conn.execute(
        f"SELECT total_value, sp500_return_pct, alpha_pct, total_pnl_pct, total_trades, win_rate, closed_trades FROM sim_portfolio_snapshots WHERE date = ? AND {where_clause} ORDER BY rowid DESC LIMIT 1",
        (resolved_end, *params),
    ).fetchone()

    if start_row is None or end_row is None:
        return {
            "total_pnl": None, "total_pnl_pct": None, "cagr": None,
            "spy_return": None, "alpha": None,
            "start_date": resolved_start, "end_date": resolved_end, "total_trades": 0,
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

    cagr = _compute_cagr(start_value, end_value, resolved_start, resolved_end)

    win_rate = end_row["win_rate"] if "win_rate" in end_row.keys() else None
    closed_trades = end_row["closed_trades"] if "closed_trades" in end_row.keys() else None

    return {
        "total_pnl": total_pnl,
        "total_pnl_pct": round(total_pnl_pct, 2) if total_pnl_pct is not None else None,
        "cagr": cagr,
        "spy_return": round(spy_return, 2) if spy_return is not None else None,
        "alpha": round(alpha, 2) if alpha is not None else None,
        "start_date": resolved_start,
        "end_date": resolved_end,
        "total_trades": total_trades,
        "win_rate": round(win_rate, 2) if win_rate is not None else None,
        "closed_trades": closed_trades,
    }


def get_portfolio_snapshots(
    conn: sqlite3.Connection,
    strategy_id: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[dict]:
    """Return time-series portfolio values for charting.

    Real schema: date, total_value, sp500_return_pct (percentage, not SPY value).
    """
    where = ["total_value IS NOT NULL"]
    params: list[str] = []
    if strategy_id:
        where.append("strategy_id = ?")
        params.append(strategy_id)
    if start_date:
        where.append("date >= ?")
        params.append(start_date)
    if end_date:
        where.append("date <= ?")
        params.append(end_date)

    rows = conn.execute(
        f"""
        SELECT date AS snapshot_date, total_value AS portfolio_value, sp500_return_pct AS spy_value
        FROM sim_portfolio_snapshots
        WHERE {' AND '.join(where)}
        ORDER BY date ASC
        """,
        params,
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
    Uses dynamic column detection so extra columns in production are included
    automatically while working with minimal test schemas.
    """
    base_keys = ["scan_date", "ticker", "decision", "conviction"]

    # Enrichment columns to pull from trade_events when available
    te_enrichment_cols = [
        "thesis_full_text", "primary_catalyst", "invalidation_trigger", "decision_tier",
        "bear_case_text", "pre_mortem_text", "moat_thesis",
        "critique_quality_score", "critique_changed_decision", "challenge_gate_result",
        "model_id", "decided_by_model",
        "pe_at_entry", "median_pe_at_entry", "roic_at_entry", "sleeve",
        "pnl_pct", "realized_rr", "max_favorable_excursion_pct", "days_held",
        "sp500_return_same_period", "exit_price", "exit_date", "exit_trigger", "exit_reason",
        "entry_price", "stop_loss", "target_1", "target_2",
    ]

    # Enrichment columns to pull from scout_candidates when available
    sc_enrichment_cols = [
        "fundamental_score", "roic_at_scan", "prev_roic", "roic_delta",
        "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
        "relative_strength", "valuation_verdict",
        "technical_score", "michael_quality_score", "beneish_m_score", "altman_z_score",
        "roic_wacc_spread", "valuation_fair_value", "valuation_upside_pct",
        "momentum_at_scan", "atr", "volume_ratio",
        "insider_signal", "insider_net_value_usd", "insider_buy_cluster",
        "sector", "regime_at_scan", "price_at_scan",
    ]

    # Detect available columns
    te_cols = _get_table_columns(conn, "trade_events")
    sc_cols = _get_table_columns(conn, "scout_candidates")
    available_te = [c for c in te_enrichment_cols if c in te_cols]
    available_sc = [c for c in sc_enrichment_cols if c in sc_cols]

    # Build all_keys from base + available enrichment
    all_keys = base_keys + available_te + available_sc

    # Try guardian_decisions first
    rows: list = []
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

    # Fallback: use trade_events as decision records (with enrichment columns)
    if not rows:
        try:
            te_select = "substr(timestamp, 1, 10) AS scan_date, ticker, event_type AS decision, conviction"
            if available_te:
                te_select += ", " + ", ".join(available_te)

            if ticker is not None:
                rows = conn.execute(
                    f"SELECT {te_select} FROM trade_events WHERE ticker = ? ORDER BY timestamp DESC",
                    (ticker,),
                ).fetchall()
            else:
                rows = conn.execute(
                    f"SELECT {te_select} FROM trade_events ORDER BY timestamp DESC LIMIT ?",
                    (limit,),
                ).fetchall()
        except Exception:
            pass

    # Build scoring lookup from scout_candidates (with enrichment columns)
    scoring_map: dict[str, dict] = {}
    try:
        sc_select = "ticker, scan_date"
        if available_sc:
            sc_select += ", " + ", ".join(available_sc)

        scoring_rows = conn.execute(
            f"SELECT {sc_select} FROM scout_candidates ORDER BY scan_date DESC"
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

        # Merge scoring from scout_candidates (fill nulls only)
        scoring = scoring_map.get(row_dict["ticker"], {})
        for k in available_sc:
            if entry.get(k) is None:
                entry[k] = scoring.get(k)

        results.append(entry)

    return results


def get_counterfactuals(conn: sqlite3.Connection, limit: int = 20) -> dict:
    """Return counterfactual analysis from rejection_log.

    Real schema: t_plus_20 (not forward_return_pct).
    """
    available_cols = _get_table_columns(conn, "rejection_log")

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


def get_ticker_deep_dive(conn: sqlite3.Connection, ticker: str) -> dict:
    """Comprehensive ticker data for deep-dive view.

    Returns all decisions, scoring history across scans, and rejection history.
    """
    decisions = get_recent_decisions(conn, ticker=ticker, limit=200)

    # Scoring history: all scout_candidates rows for this ticker
    scoring_history: list[dict] = []
    try:
        sc_cols = _get_table_columns(conn, "scout_candidates")
        sc_fields = ["scan_date", "ticker"]
        sc_enrichment = [
            "fundamental_score", "technical_score", "roic_at_scan", "prev_roic",
            "roic_delta", "rsi", "pe_at_scan", "median_pe", "pe_discount_pct",
            "relative_strength", "valuation_verdict", "michael_quality_score",
            "beneish_m_score", "altman_z_score", "momentum_at_scan",
            "price_at_scan", "sector",
        ]
        sc_available = [c for c in sc_enrichment if c in sc_cols]
        sc_select = ", ".join(sc_fields + sc_available)

        rows = conn.execute(
            f"SELECT {sc_select} FROM scout_candidates WHERE ticker = ? ORDER BY scan_date DESC",
            (ticker,),
        ).fetchall()
        scoring_history = [dict(r) for r in rows]
    except Exception:
        pass

    # Rejection history
    rejection_history: list[dict] = []
    try:
        rl_cols = _get_table_columns(conn, "rejection_log")
        rl_fields = ["scan_date", "ticker", "rejected_at_gate", "rejection_reason"]
        rl_extra = [c for c in ["t_plus_5", "t_plus_10", "t_plus_20"] if c in rl_cols]
        rl_select = ", ".join(rl_fields + rl_extra)

        rows = conn.execute(
            f"SELECT {rl_select} FROM rejection_log WHERE ticker = ? ORDER BY scan_date DESC",
            (ticker,),
        ).fetchall()
        rejection_history = [dict(r) for r in rows]
    except Exception:
        pass

    return {
        "decisions": decisions,
        "scoring_history": scoring_history,
        "rejection_history": rejection_history,
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
