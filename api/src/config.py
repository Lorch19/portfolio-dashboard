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
