from typing import Literal

from pydantic import HttpUrl
from pydantic_settings import BaseSettings


class Environment(BaseSettings):
    BROWSERBASE_API_KEY: str
    BROWSERBASE_ENV: Literal["LOCAL", "BROWSERBASE"] = "LOCAL"
    BROWSERBASE_PROJECT_ID: str
    BROWSERBASE_USE_PROXIES: bool = False
    CONCURRENT_BROWSER_SESSIONS: int = 1
    ENV: Literal["dev", "prd"] = "dev"
    GEMINI_API_KEY: str
    LLM_GATEWAY_BASE_URL: HttpUrl = HttpUrl("https://ai-gateway.helicone.ai")
    LLM_GATEWAY_API_KEY: str
    SUPABASE_URL: HttpUrl
    SUPABASE_KEY: str


environment = Environment()  # ty: ignore[missing-argument] Read from environment instead of passing as arguments.
