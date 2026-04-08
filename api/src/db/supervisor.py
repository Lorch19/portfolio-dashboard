import logging
import sqlite3

logger = logging.getLogger(__name__)

def get_agent_statuses(conn: sqlite3.Connection) -> list[dict]:
    """Get latest health check per component from health_checks table.

    Returns ALL components found in the DB (not a hardcoded list).
    Real schema: id, timestamp, component, status, details, created_at.
    """
    rows = conn.execute(
        """
        SELECT component AS agent_name, status, timestamp AS last_run, details, created_at AS checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY component
        )
        ORDER BY CASE LOWER(status)
            WHEN 'down' THEN 0
            WHEN 'degraded' THEN 1
            WHEN 'healthy' THEN 2
            ELSE 3
        END, component
        """
    ).fetchall()
    return [dict(row) for row in rows]


def get_heartbeat_status(conn: sqlite3.Connection) -> dict:
    """Get heartbeat summary: agent_name -> latest status and checked_at."""
    rows = conn.execute(
        """
        SELECT component AS agent_name, status, created_at AS checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY component
        )
        ORDER BY component
        """
    ).fetchall()
    return {row["agent_name"]: {"status": row["status"], "checked_at": row["checked_at"]} for row in rows}


def get_recent_alerts(conn: sqlite3.Connection, limit: int = 20) -> list[dict]:
    """Get recent alert events from events table.

    Real schema: id, timestamp, source, event_type, strategy_id, payload, processed, created_at
    """
    rows = conn.execute(
        """
        SELECT id, source, event_type, payload AS data, created_at
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
        SELECT id, source, event_type, payload AS data, created_at
        FROM events
        WHERE source = 'shadow_observer'
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_hold_point_status(conn: sqlite3.Connection, limit: int = 20) -> dict:
    """Get hold point / drawdown status from events table."""
    rows = conn.execute(
        """
        SELECT id, source, event_type, payload AS data, created_at
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
    """Get latest health check per unique component/daemon."""
    rows = conn.execute(
        """
        SELECT component, status, details, created_at AS checked_at
        FROM health_checks
        WHERE id IN (
            SELECT MAX(id) FROM health_checks GROUP BY component
        )
        ORDER BY component
        """
    ).fetchall()
    return [dict(row) for row in rows]


def get_prediction_accuracy(conn: sqlite3.Connection) -> dict:
    """Return prediction accuracy metrics from predictions table.

    Real supervisor schema: id, timestamp, prediction_type, ticker, entry_price,
    exit_price, direction, confidence, score, sleeve, source_run_id, source_table,
    raw_data, metadata, strategy_id, created_at.

    Real eval_results schema: id, prediction_id, eval_date, eval_window_days,
    actual_price, actual_return_pct, benchmark_return_pct, alpha_pct,
    direction_correct, notes, created_at.
    """
    # Total predictions
    row = conn.execute("SELECT COUNT(*) AS total FROM predictions").fetchone()
    total = row["total"]

    if total == 0:
        return {
            "total_predictions": 0,
            "resolved_count": 0,
            "hit_rate": None,
            "hit_rate_by_window": {"t_5": None, "t_10": None, "t_20": None},
            "average_brier_score": None,
        }

    # Count evaluated predictions (those with eval_results)
    eval_row = conn.execute(
        """
        SELECT COUNT(DISTINCT prediction_id) AS resolved
        FROM eval_results
        """
    ).fetchone()
    resolved = eval_row["resolved"] or 0

    # Hit rate from eval_results (direction_correct)
    hit_row = conn.execute(
        """
        SELECT COUNT(*) AS total_evals,
               SUM(CASE WHEN direction_correct = 1 THEN 1 ELSE 0 END) AS total_hits
        FROM eval_results
        """
    ).fetchone()

    total_evals = hit_row["total_evals"]
    total_hits = hit_row["total_hits"] or 0
    hit_rate = round(total_hits / total_evals, 4) if total_evals > 0 else None

    # Hit rate by eval window (eval_window_days: 5, 10, 20)
    window_rows = conn.execute(
        """
        SELECT eval_window_days, COUNT(*) AS cnt,
               SUM(CASE WHEN direction_correct = 1 THEN 1 ELSE 0 END) AS hits
        FROM eval_results
        GROUP BY eval_window_days
        """
    ).fetchall()

    hit_by_window = {"t_5": None, "t_10": None, "t_20": None}
    for wr in window_rows:
        window_days = wr["eval_window_days"]
        cnt = wr["cnt"]
        hits = wr["hits"] or 0
        rate = round(hits / cnt, 4) if cnt > 0 else None
        key = f"t_{window_days}"
        if key in hit_by_window:
            hit_by_window[key] = rate

    # Average score from predictions (no brier_score in supervisor predictions)
    score_row = conn.execute(
        "SELECT AVG(score) AS avg_score FROM predictions WHERE score IS NOT NULL"
    ).fetchone()
    avg_score = round(score_row["avg_score"], 4) if score_row["avg_score"] is not None else None

    return {
        "total_predictions": total,
        "resolved_count": resolved,
        "hit_rate": hit_rate,
        "hit_rate_by_window": hit_by_window,
        "average_brier_score": avg_score,
    }


def get_calibration_scores(conn: sqlite3.Connection) -> dict:
    """Return calibration metrics from predictions table.

    Supervisor predictions has: confidence, score (not brier_score).
    """
    row = conn.execute(
        """
        SELECT AVG(score) AS avg_score,
               COUNT(*) AS total
        FROM predictions
        WHERE score IS NOT NULL
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

    avg_score = round(row["avg_score"], 4) if row["avg_score"] is not None else None
    beating_random = avg_score < 0.25 if avg_score is not None else None

    # Direction accuracy from eval_results
    agreement_row = conn.execute(
        """
        SELECT COUNT(*) AS total,
               SUM(CASE WHEN direction_correct = 1 THEN 1 ELSE 0 END) AS agreed
        FROM eval_results
        """
    ).fetchone()

    if agreement_row["total"] > 0:
        agreement_rate = round(agreement_row["agreed"] / agreement_row["total"], 4)
        sycophancy_flag = agreement_rate > 0.95 and (avg_score is not None and avg_score > 0.25)
    else:
        agreement_rate = None
        sycophancy_flag = None

    return {
        "average_brier_score": avg_score,
        "target_brier": 0.25,
        "beating_random": beating_random,
        "agreement_rate": agreement_rate,
        "sycophancy_flag": sycophancy_flag,
    }


def get_decision_predictions(
    conn: sqlite3.Connection, tickers: list[str] | None = None, limit: int = 200,
) -> list[dict]:
    """Return per-ticker prediction outcomes from supervisor predictions.

    Supervisor schema: id, timestamp, prediction_type, ticker, direction,
    confidence, score, created_at.
    """
    if tickers:
        placeholders = ",".join("?" for _ in tickers)
        rows = conn.execute(
            f"""
            SELECT ticker, timestamp AS scan_date, direction AS predicted_outcome,
                   confidence AS probability, score AS brier_score
            FROM predictions
            WHERE ticker IN ({placeholders})
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            [*tickers, limit],
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT ticker, timestamp AS scan_date, direction AS predicted_outcome,
                   confidence AS probability, score AS brier_score
            FROM predictions
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [
        {
            "ticker": row["scan_date"] and row["ticker"],  # might be null
            "scan_date": row["scan_date"],
            "predicted_outcome": row["predicted_outcome"],
            "probability": row["probability"],
            "actual_outcome": None,
            "resolved": None,
            "brier_score": round(row["brier_score"], 4) if row["brier_score"] is not None else None,
        }
        for row in rows
    ]


def get_arena_comparison(conn: sqlite3.Connection) -> list[dict]:
    """Return per-model arena comparison stats.

    Real arena_forward_returns has per-ticker forward return data
    with t_plus_5/10/20 columns instead of a single forward_return.
    arena_decisions has session_id, model_id, cost_usd, decision_count.
    Both tables are in portfolio.db, not supervisor.db.
    """
    # This function is called with supervisor conn but arena data is in portfolio.db
    # Return empty — arena data is queried separately in the performance router
    return []
