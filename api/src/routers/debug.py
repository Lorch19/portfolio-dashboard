import logging
import re
from pathlib import Path

from fastapi import APIRouter, Query

from src.config import settings
from src.db.connection import get_db_connection
from src.db.debug import get_pipeline_replay, get_raw_events

router = APIRouter()
logger = logging.getLogger(__name__)

# Allowed agent names to prevent path traversal
ALLOWED_AGENTS = {"scout", "radar", "guardian", "chronicler", "michael", "shadow_observer", "supervisor"}


@router.get("/api/debug/events")
def debug_events(
    source: str | None = Query(None),
    type: str | None = Query(None),
    since: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Raw event bus viewer — returns events from supervisor events table."""
    supervisor_path = settings.supervisor_db_path
    if not supervisor_path:
        return {"events": [], "events_error": "michael_supervisor.db not configured"}

    try:
        conn = get_db_connection(supervisor_path)
    except Exception as exc:
        return {"events": [], "events_error": f"michael_supervisor.db not accessible: {exc}"}

    try:
        events = get_raw_events(conn, source=source, event_type=type, since=since, limit=limit)
        return {"events": events, "events_error": None}
    except Exception as exc:
        logger.exception("Error querying debug events")
        return {"events": [], "events_error": str(exc)}
    finally:
        conn.close()


@router.get("/api/debug/logs")
def debug_logs(
    agent: str | None = Query(None),
    date: str | None = Query(None),
    severity: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """Agent log file reader — returns parsed log entries from disk."""
    log_dir = settings.log_dir
    if not log_dir:
        return {"logs": [], "logs_error": None, "message": "Log directory not configured"}

    log_path = Path(log_dir)
    if not log_path.is_dir():
        return {"logs": [], "logs_error": None, "message": "Log directory not found"}

    # Validate agent name if provided (prevent path traversal)
    if agent and agent.lower() not in ALLOWED_AGENTS:
        return {"logs": [], "logs_error": f"Unknown agent: {agent}"}

    entries: list[dict] = []

    # Discover log files: look for {agent}.log or {agent}_{date}.log patterns
    log_files: list[Path] = []
    if agent:
        candidates = [
            log_path / f"{agent.lower()}.log",
            log_path / f"{agent.lower()}_{date}.log" if date else None,
        ]
        log_files = [f for f in candidates if f is not None and f.is_file()]
        if not log_files:
            # Try glob for date-based files
            log_files = sorted(log_path.glob(f"{agent.lower()}*.log"))
    else:
        log_files = sorted(log_path.glob("*.log"))

    severity_upper = severity.upper() if severity else None
    # Standard Python logging format: 2026-04-04 06:00:00 - agent - LEVEL - message
    log_pattern = re.compile(
        r"^(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})\s*[-|]\s*(\w[\w\s]*?)\s*[-|]\s*(DEBUG|INFO|WARNING|ERROR|CRITICAL)\s*[-|]\s*(.*)",
    )

    for log_file in log_files:
        try:
            with open(log_file, "r", errors="replace") as f:
                current_entry: dict | None = None
                for line in f:
                    match = log_pattern.match(line.rstrip())
                    if match:
                        # Flush previous entry
                        if current_entry and len(entries) < limit:
                            entries.append(current_entry)

                        ts, agent_name, level, message = match.groups()

                        # Date filter
                        if date and not ts.startswith(date):
                            current_entry = None
                            continue

                        # Severity filter
                        if severity_upper and level != severity_upper:
                            current_entry = None
                            continue

                        current_entry = {
                            "timestamp": ts,
                            "agent": agent_name.strip(),
                            "severity": level,
                            "message": message,
                            "trace": None,
                            "source_file": log_file.name,
                        }
                    elif current_entry is not None:
                        # Continuation line (stack trace)
                        if current_entry["trace"] is None:
                            current_entry["trace"] = line.rstrip()
                        else:
                            current_entry["trace"] += "\n" + line.rstrip()

                # Flush last entry
                if current_entry and len(entries) < limit:
                    entries.append(current_entry)
        except Exception as exc:
            logger.warning("Error reading log file %s: %s", log_file, exc)

    # Sort by timestamp descending (most recent first)
    entries.sort(key=lambda e: e["timestamp"], reverse=True)
    entries = entries[:limit]

    return {"logs": entries, "logs_error": None, "message": None}


@router.get("/api/debug/replay/dates")
def debug_replay_dates():
    """Return available pipeline run dates (scan_dates with scout data)."""
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        return {"dates": [], "dates_error": "portfolio.db not configured"}
    try:
        conn = get_db_connection(portfolio_path)
    except Exception as exc:
        return {"dates": [], "dates_error": str(exc)}
    try:
        rows = conn.execute(
            "SELECT DISTINCT scan_date FROM scout_candidates ORDER BY scan_date DESC LIMIT 30"
        ).fetchall()
        return {"dates": [r["scan_date"] for r in rows], "dates_error": None}
    except Exception as exc:
        return {"dates": [], "dates_error": str(exc)}
    finally:
        conn.close()


@router.get("/api/debug/replay")
def debug_replay(
    date: str = Query(..., description="Pipeline run date (YYYY-MM-DD)"),
):
    """Pipeline cycle replay — reconstructs a full cycle from portfolio.db."""
    portfolio_path = settings.portfolio_db_path
    if not portfolio_path:
        return {
            "date": date,
            "steps": [],
            "message": "portfolio.db not configured",
            "replay_error": "portfolio.db not configured",
        }

    try:
        conn = get_db_connection(portfolio_path)
    except Exception as exc:
        return {
            "date": date,
            "steps": [],
            "message": None,
            "replay_error": f"portfolio.db not accessible: {exc}",
        }

    try:
        result = get_pipeline_replay(conn, scan_date=date)
        result["replay_error"] = None
        return result
    except Exception as exc:
        logger.exception("Error building pipeline replay")
        return {
            "date": date,
            "steps": [],
            "message": None,
            "replay_error": str(exc),
        }
    finally:
        conn.close()
