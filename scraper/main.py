import asyncio
from contextlib import AsyncExitStack

from stagehand import Stagehand, StagehandConfig

import controller
import db
from env import environment
from logger import get_logger
from schemas import Subreddit

logger = get_logger(__name__)


async def main():
    subreddits = await controller.get_subreddits(
        "https://www.reddit.com/best/communities/16/",
    )
    if not subreddits:
        logger.info("No subreddits found to process.")
        return

    pool_size = min(environment.CONCURRENT_BROWSER_SESSIONS, len(subreddits))
    stagehand_queue: asyncio.Queue[Stagehand] = asyncio.Queue()

    async with AsyncExitStack() as stack:
        for _ in range(pool_size):
            stagehand = await stack.enter_async_context(
                Stagehand(
                    config=StagehandConfig(
                        browserbase_session_create_params={  # ty: ignore[unknown-argument]
                            "proxies": environment.BROWSERBASE_USE_PROXIES
                        },
                        env=environment.BROWSERBASE_ENV,
                        model_api_key=environment.LLM_GATEWAY_API_KEY,  # ty: ignore[unknown-argument]
                        model_name="openai/gpt-5-nano",  # ty: ignore[unknown-argument]
                        model_client_options={  # ty: ignore[unknown-argument]
                            "api_base": str(environment.LLM_GATEWAY_BASE_URL),
                            "headers": {
                                "Helicone-Auth": f"Bearer {environment.LLM_GATEWAY_API_KEY}",
                            },
                        },
                    ),
                )
            )
            stagehand_queue.put_nowait(stagehand)

        async def process_subreddit(subreddit: Subreddit):
            if db.is_subreddit_scraped_at_before(subreddit.name, hours=24):
                logger.info("Skipping r/%s; scraped recently.", subreddit.name)
                return

            stagehand = await stagehand_queue.get()
            try:
                browser_page = stagehand.page
                if not browser_page:
                    raise Exception("Failed to get page instance from Stagehand")
                rules = await controller.get_subreddit_rules(browser_page, subreddit)
                self_promotion_extraction = await controller.get_self_promotion_status(
                    subreddit, rules
                )
                await db.upsert_subreddit_with_rules(
                    subreddit=subreddit,
                    rules=rules,
                    self_promotion_extraction=self_promotion_extraction,
                )
                await db.update_subreddit_metadata(subreddit)
            finally:
                stagehand_queue.put_nowait(stagehand)

        await asyncio.gather(
            *(process_subreddit(subreddit) for subreddit in subreddits)
        )

    for subreddit in subreddits:
        await db.update_subreddit_metadata(subreddit)


if __name__ == "__main__":
    asyncio.run(main())
