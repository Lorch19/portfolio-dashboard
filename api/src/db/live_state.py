"""Live portfolio state via a subprocess call into portfolio-system's SimPortfolio.

This is the single source of truth for "current" strategy values — the same code
path used by the morning pipeline and Telegram messages. Snapshots in
sim_portfolio_snapshots remain the source for historical time-series data.

We use a subprocess (not direct import) because both portfolio-dashboard and
portfolio-system use `src/` as their top-level package, creating an unresolvable
module-name collision if loaded into the same Python process. The subprocess
isolates the namespaces. Results are cached for TTL_SECONDS to avoid hammering
yfinance on every dashboard page load.
"""

from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
import time

logger = logging.getLogger(__name__)

# Default assumes portfolio-system is a sibling of portfolio-dashboard
_DEFAULT_PS_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "portfolio-system")
)
PORTFOLIO_SYSTEM_PATH = os.getenv("PORTFOLIO_SYSTEM_PATH", _DEFAULT_PS_PATH)

# Starting capital per strategy (matches portfolio-system's SIM_PORTFOLIO config)
STARTING_CAPITAL = 100_000.0

# TTL cache for the full batch of live states. Single entry because we fetch all at once.
# Key: (portfolio_db_path,) → (timestamp, {strategy_id: state_dict})
_batch_cache: dict[tuple, tuple[float, dict]] = {}
TTL_SECONDS = 60

# Bash script runs inside portfolio-system's working dir so relative paths resolve
_HELPER = r"""
import json
import os
import sys

sys.path.insert(0, sys.argv[1])
os.chdir(sys.argv[1])

try:
    from db.database import Database
    from src.pipeline.sim_portfolio import SimPortfolio
    from src.data.cache import DataCache
    from src.data.provider import YFinanceProvider
except Exception as exc:
    print(json.dumps({"_error": f"import failed: {type(exc).__name__}: {exc}"}))
    sys.exit(0)

db_path = sys.argv[2]

try:
    db = Database(db_path)
    db.initialize()
    cache = DataCache(provider=YFinanceProvider())

    # Discover all strategies with open positions
    rows = db.fetch_all(
        "SELECT DISTINCT strategy_id FROM sim_positions WHERE status='open' ORDER BY strategy_id"
    )
    strategy_ids = [r["strategy_id"] for r in rows] if rows else []

    results = {}
    for sid in strategy_ids:
        sim = SimPortfolio(db, cache=cache, strategy_id=sid)
        state = sim.get_state()
        open_row = db.fetch_one(
            "SELECT MIN(entry_date) AS first FROM sim_positions "
            "WHERE status='open' AND strategy_id=?",
            (sid,),
        )
        ever_row = db.fetch_one(
            "SELECT MIN(entry_date) AS first FROM sim_positions WHERE strategy_id=?",
            (sid,),
        )
        results[sid] = {
            "total_value": float(state.total_value),
            "cash": float(state.cash),
            "positions_count": len(state.positions),
            "entry_date": open_row["first"] if open_row else None,
            "first_entry_date_ever": ever_row["first"] if ever_row else None,
        }
    print(json.dumps(results))
except Exception as exc:
    print(json.dumps({"_error": f"{type(exc).__name__}: {exc}"}))
    sys.exit(0)
"""


def _fetch_all_live_states(portfolio_db_path: str) -> dict:
    """Run the helper subprocess and return the full batch of live states."""
    if not os.path.isdir(PORTFOLIO_SYSTEM_PATH):
        logger.warning("portfolio-system path not found: %s", PORTFOLIO_SYSTEM_PATH)
        return {}

    try:
        proc = subprocess.run(
            [sys.executable, "-c", _HELPER, PORTFOLIO_SYSTEM_PATH, portfolio_db_path],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        logger.warning("live state helper timed out")
        return {}
    except Exception as exc:
        logger.warning("live state helper failed to launch: %s", exc)
        return {}

    if proc.returncode != 0:
        logger.warning("live state helper exited %d: %s", proc.returncode, proc.stderr[:500])
        return {}

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        logger.warning("live state helper returned non-JSON: %s", exc)
        logger.debug("stdout: %s", proc.stdout[:500])
        return {}

    if isinstance(data, dict) and "_error" in data:
        logger.warning("live state helper reported error: %s", data["_error"])
        return {}
    return data


def _get_batch(portfolio_db_path: str) -> dict:
    """Return cached or fresh batch of live states for all strategies."""
    now = time.time()
    key = (portfolio_db_path,)
    cached = _batch_cache.get(key)
    if cached and (now - cached[0]) < TTL_SECONDS:
        return cached[1]
    data = _fetch_all_live_states(portfolio_db_path)
    _batch_cache[key] = (now, data)
    return data


def get_live_strategy_state(strategy_id: str, portfolio_db_path: str) -> dict | None:
    """Return live state for a single strategy (or None if unavailable)."""
    batch = _get_batch(portfolio_db_path)
    return batch.get(strategy_id)


def get_active_strategy_ids(portfolio_db_path: str) -> list[str]:
    """Return all strategy_ids with open positions."""
    batch = _get_batch(portfolio_db_path)
    return sorted(batch.keys())
