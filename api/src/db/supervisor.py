import logging
import sqlite3

logger = logging.getLogger(__name__)

EXPECTED_AGENTS = ["Chronicler", "Guardian", "Michael", "Radar", "Scout", "Shadow Observer"]


def get_agent_statuses(conn: sqlite3.Connection) -> list[dict]:
    """Get latest health check per agent from health_checks table.

    Returns one entry per expected agent. Agents with no rows in the DB
    are backfilled with null values. The ``last_run`` field reflects the
    most recent execution timestamp regardless of outcome (not filtered
    by success status — see AC1 interpretation note in review findings).
    """
    rows = conn.execute(
        """
        SELECT agent_name, status, last_run, details, checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY agent_name
        )
        ORDER BY agent_name
        """
    ).fetchall()
    found = {row["agent_name"]: dict(row) for row in rows}
    return [
        found.get(name, {"agent_name": name, "status": None, "last_run": None, "details": None, "checked_at": None})
        for name in EXPECTED_AGENTS
    ]


def get_heartbeat_status(conn: sqlite3.Connection) -> dict:
    """Get heartbeat summary: agent_name -> latest status and checked_at."""
    rows = conn.execute(
        """
        SELECT agent_name, status, checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY agent_name
        )
        ORDER BY agent_name
        """
    ).fetchall()
    return {row["agent_name"]: {"status": row["status"], "checked_at": row["checked_at"]} for row in rows}


def get_recent_alerts(conn: sqlite3.Connection, limit: int = 20) -> list[dict]:
    """Get recent alert events from events table."""
    rows = conn.execute(
        """
        SELECT id, source, event_type, data, created_at
        FROM events
        WHERE event_type = 'alert'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_shadow_observer_events(conn: sqlite3.Connection, limit: int = 50) -> list[dict]:
    """Get recent Shadow Observer events from events table."""
    rows = conn.execute(
        """
        SELECT id, source, event_type, data, created_at
        FROM events
        WHERE source = 'shadow_observer'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_hold_point_status(conn: sqlite3.Connection, limit: int = 20) -> dict:
    """Get hold point / drawdown status from events table.

    Returns current state (active/paused) and recent hold-point events.
    No drawdown_state table exists — data sourced from events only.
    """
    rows = conn.execute(
        """
        SELECT id, source, event_type, data, created_at
        FROM events
        WHERE event_type IN (
            'hold_point_triggered',
            'hold_point_released',
            'drawdown_pause',
            'drawdown_resume',
            'pause',
            'halt'
        )
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    events = [dict(row) for row in rows]
    # Derive state from most recent event: if the latest hold-point event
    # indicates a pause, report paused; otherwise active.
    state = "active"
    if events:
        latest_type = events[0]["event_type"].lower()
        if "pause" in latest_type or "halt" in latest_type:
            state = "paused"
    return {
        "state": state,
        "trigger_pct": None,
        "events": events,
    }


def get_daemon_status(conn: sqlite3.Connection) -> list[dict]:
    """Get latest health check per unique component/daemon.

    Returns ALL entries from health_checks (not limited to the 6 pipeline
    agents), giving visibility into daemon-level components.
    """
    rows = conn.execute(
        """
        SELECT agent_name AS component, status, details, checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY agent_name
        )
        ORDER BY agent_name
        """
    ).fetchall()
    return [dict(row) for row in rows]


def get_prediction_accuracy(conn: sqlite3.Connection) -> dict:
    """Return prediction accuracy metrics from predictions and eval_results tables.

    Returns: total_predictions, resolved_count, hit_rate, hit_rate_by_window
    (t_5, t_10, t_20), average_brier_score.
    """
    # Total and resolved predictions
    row = conn.execute(
        """
        SELECT COUNT(*) AS total, SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) AS resolved
        FROM predictions
        """
    ).fetchone()

    total = row["total"]
    resolved = row["resolved"] or 0

    if total == 0:
        return {
            "total_predictions": 0,
            "resolved_count": 0,
            "hit_rate": None,
            "hit_rate_by_window": {"t_5": None, "t_10": None, "t_20": None},
            "average_brier_score": None,
        }

    # Overall hit rate from eval_results
    hit_row = conn.execute(
        """
        SELECT COUNT(*) AS total_evals, SUM(hit) AS total_hits
        FROM eval_results
        """
    ).fetchone()

    total_evals = hit_row["total_evals"]
    total_hits = hit_row["total_hits"] or 0
    hit_rate = round(total_hits / total_evals, 4) if total_evals > 0 else None

    # Hit rate by eval window
    window_rows = conn.execute(
        """
        SELECT eval_window, COUNT(*) AS cnt, SUM(hit) AS hits
        FROM eval_results
        GROUP BY eval_window
        """
    ).fetchall()

    hit_by_window = {"t_5": None, "t_10": None, "t_20": None}
    for wr in window_rows:
        window = wr["eval_window"]
        cnt = wr["cnt"]
        hits = wr["hits"] or 0
        rate = round(hits / cnt, 4) if cnt > 0 else None
        # Normalize window names: "T+5" -> "t_5", "t_5" -> "t_5"
        key = window.lower().replace("+", "_").replace("-", "_")
        if key in hit_by_window:
            hit_by_window[key] = rate
        else:
            logger.warning("Unrecognized eval_window value: %s (normalized: %s)", window, key)

    # Average Brier score from resolved predictions
    brier_row = conn.execute(
        """
        SELECT AVG(brier_score) AS avg_brier
        FROM predictions
        WHERE resolved = 1 AND brier_score IS NOT NULL
        """
    ).fetchone()

    avg_brier = round(brier_row["avg_brier"], 4) if brier_row["avg_brier"] is not None else None

    return {
        "total_predictions": total,
        "resolved_count": resolved,
        "hit_rate": hit_rate,
        "hit_rate_by_window": hit_by_window,
        "average_brier_score": avg_brier,
    }


def get_calibration_scores(conn: sqlite3.Connection) -> dict:
    """Return CalibrationEngine metrics from predictions table.

    Returns: average_brier_score, target_brier (0.25), beating_random,
    agreement_rate, sycophancy_flag.
    """
    row = conn.execute(
        """
        SELECT AVG(brier_score) AS avg_brier,
               COUNT(*) AS total,
               SUM(CASE WHEN resolved = 1 THEN 1 ELSE 0 END) AS resolved
        FROM predictions
        WHERE brier_score IS NOT NULL
        """
    ).fetchone()

    if row is None or row["total"] == 0:
        return {
            "average_brier_score": None,
            "target_brier": 0.25,
            "beating_random": None,
            "agreement_rate": None,
            "sycophancy_flag": None,
        }

    avg_brier = round(row["avg_brier"], 4) if row["avg_brier"] is not None else None
    beating_random = avg_brier < 0.25 if avg_brier is not None else None

    # Agreement rate: fraction of predictions where predicted_outcome matches actual_outcome
    agreement_row = conn.execute(
        """
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN predicted_outcome = actual_outcome THEN 1 ELSE 0 END) AS agreed
        FROM predictions
        WHERE resolved = 1 AND actual_outcome IS NOT NULL
        """
    ).fetchone()

    if agreement_row["total"] > 0:
        agreement_rate = round(agreement_row["agreed"] / agreement_row["total"], 4)
        # Sycophancy flag: if agreement rate is suspiciously high (>0.95)
        # and Brier score is poor (>0.25), predictions may be sycophantic
        sycophancy_flag = agreement_rate > 0.95 and (avg_brier is not None and avg_brier > 0.25)
    else:
        agreement_rate = None
        sycophancy_flag = None

    return {
        "average_brier_score": avg_brier,
        "target_brier": 0.25,
        "beating_random": beating_random,
        "agreement_rate": agreement_rate,
        "sycophancy_flag": sycophancy_flag,
    }


def get_decision_predictions(
    conn: sqlite3.Connection, tickers: list[str] | None = None, limit: int = 200,
) -> list[dict]:
    """Return per-ticker prediction outcomes for the decisions endpoint.

    Queries predictions for prediction outcomes ordered by scan_date DESC.
    Returns: ticker, scan_date, predicted_outcome, probability,
    actual_outcome, resolved, brier_score.

    Args:
        conn: Read-only sqlite3 connection to michael_supervisor.db.
        tickers: Optional list of tickers to filter by.
        limit: Max rows to return (default 200).
    """
    if tickers:
        placeholders = ",".join("?" for _ in tickers)
        rows = conn.execute(
            f"""
            SELECT p.ticker, p.scan_date, p.predicted_outcome, p.probability,
                   p.actual_outcome, p.resolved, p.brier_score
            FROM predictions p
            WHERE p.ticker IN ({placeholders})
            ORDER BY p.scan_date DESC
            LIMIT ?
            """,
            [*tickers, limit],
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT p.ticker, p.scan_date, p.predicted_outcome, p.probability,
                   p.actual_outcome, p.resolved, p.brier_score
            FROM predictions p
            ORDER BY p.scan_date DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        {
            "ticker": row["ticker"],
            "scan_date": row["scan_date"],
            "predicted_outcome": row["predicted_outcome"],
            "probability": row["probability"],
            "actual_outcome": row["actual_outcome"],
            "resolved": row["resolved"],
            "brier_score": round(row["brier_score"], 4) if row["brier_score"] is not None else None,
        }
        for row in rows
    ]


def get_arena_comparison(conn: sqlite3.Connection) -> list[dict]:
    """Return per-model arena comparison stats grouped by session.

    Queries arena_decisions JOIN arena_forward_returns for: model_id,
    session_id, total_decisions, hit_rate, average_alpha, total_cost.
    """
    rows = conn.execute(
        """
        SELECT
            ad.model_id,
            ad.session_id,
            COUNT(*) AS total_decisions,
            SUM(CASE WHEN afr.forward_return IS NOT NULL AND afr.forward_return > 0 THEN 1 ELSE 0 END) AS hits,
            SUM(CASE WHEN afr.forward_return IS NOT NULL THEN 1 ELSE 0 END) AS evaluated,
            AVG(afr.forward_return) AS avg_alpha,
            SUM(ad.cost_usd) AS total_cost
        FROM arena_decisions ad
        LEFT JOIN arena_forward_returns afr ON afr.arena_decision_id = ad.id
        GROUP BY ad.model_id, ad.session_id
        ORDER BY ad.session_id, ad.model_id
        """
    ).fetchall()

    results = []
    for row in rows:
        total = row["total_decisions"]
        hits = row["hits"] or 0
        evaluated = row["evaluated"] or 0
        results.append({
            "model_id": row["model_id"],
            "session": row["session_id"],
            "total_decisions": total,
            "hit_rate": round(hits / evaluated, 4) if evaluated > 0 else None,
            "average_alpha": round(row["avg_alpha"], 4) if row["avg_alpha"] is not None else None,
            "total_cost": round(row["total_cost"], 2) if row["total_cost"] is not None else 0.0,
        })

    return results
