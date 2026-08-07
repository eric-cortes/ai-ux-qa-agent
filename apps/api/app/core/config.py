from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AI UX QA Agent API"
    database_url: str = "postgresql://postgres:postgres@localhost:5432/ai_ux_qa"
    redis_url: str = "redis://localhost:6379/0"
    artifact_storage: str = "local"
    artifact_local_dir: str = "./storage/artifacts"
    openai_model: str = "gpt-4o-mini"


settings = Settings()
