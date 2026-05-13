from google import genai
from openai import AsyncOpenAI

from env import environment

openai_client = AsyncOpenAI(
    base_url=str(environment.LLM_GATEWAY_BASE_URL),
    api_key=environment.LLM_GATEWAY_API_KEY,
    default_headers={
        "Helicone-Retry-Enabled": "true",
        "Helicone-Retry-Num": "3",
        "Helicone-Cache-Enabled": "true",
        "Cache-Control": "max-age=31536000",
        "Helicone-Property-Environment": environment.ENV,
    },
)


gemini_client = genai.Client(api_key=environment.GEMINI_API_KEY)
