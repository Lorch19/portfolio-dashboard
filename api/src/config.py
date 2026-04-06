import os


class Settings:
    def __init__(self) -> None:
        self.cors_origins: list[str] = [
            origin.strip()
            for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
            if origin.strip()
        ]
        self.portfolio_db_path: str = os.getenv("PORTFOLIO_DB_PATH", "")
        self.supervisor_db_path: str = os.getenv("SUPERVISOR_DB_PATH", "")


settings = Settings()

# Static mapping of pipeline components to their Strangler Fig migration state.
# v1-cron: component runs via legacy cron schedule
# v2-supervisor: component runs under the v2 supervisor daemon
# dual: component runs under both systems during migration
STRANGLER_FIG_STATUS: dict[str, dict[str, str]] = {
    "Scout": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Radar": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Guardian": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Chronicler": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Michael": {"mode": "v1-cron", "description": "Runs via cron schedule"},
    "Shadow Observer": {"mode": "v2-supervisor", "description": "Supervisor daemon"},
    "DataBridge": {"mode": "v2-supervisor", "description": "Supervisor sync service"},
    "Health Monitor": {"mode": "v2-supervisor", "description": "Supervisor health checks"},
}


def get_strangler_fig_status() -> dict:
    """Return Strangler Fig config with computed progress summary."""
    total = len(STRANGLER_FIG_STATUS)
    v2_count = sum(1 for c in STRANGLER_FIG_STATUS.values() if c["mode"] == "v2-supervisor")
    return {
        "components": {k: dict(v) for k, v in STRANGLER_FIG_STATUS.items()},
        "progress_summary": f"{v2_count}/{total} components on v2-supervisor",
    }
