import os


class Settings:
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    portfolio_db_path: str = os.getenv("PORTFOLIO_DB_PATH", "")
    supervisor_db_path: str = os.getenv("SUPERVISOR_DB_PATH", "")


settings = Settings()
