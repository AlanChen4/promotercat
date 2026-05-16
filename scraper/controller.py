import asyncio
from typing import cast

import httpx
from stagehand import StagehandPage

import ai
from lib.stagehand import block_images
from logger import get_logger
from prompts import (
    RULES_EXTRACTION_SYSTEM_PROMPT,
    SELF_PROMOTION_EXTRACTION_SYSTEM_PROMPT,
)
from schemas import (
    Rule,
    RulesExtraction,
    SelfPromotionExtraction,
    Subreddit,
)

logger = get_logger(__name__)


async def get_subreddits(url: str) -> list[Subreddit]:
    logger.info(
        "Extracting subreddits from %s",
        url,
    )
    subreddits: list[Subreddit] = []
    seen_subreddit_names = set()

    # Reddit blocks default user-agents with a JS-challenge page. A unique,
    # descriptive UA on the JSON endpoint bypasses both the challenge and the
    # generic UA rate limit.
    headers = {"User-Agent": "promotercat-scraper/0.1"}
    async with httpx.AsyncClient(headers=headers) as client:
        response = await client.get(url)
        response.raise_for_status()
        listing = response.json()
        for child in listing["data"]["children"]:
            data = child["data"]
            subreddit_name = data["display_name"]
            if subreddit_name in seen_subreddit_names:
                continue
            seen_subreddit_names.add(subreddit_name)
            description = (data.get("public_description") or "").strip() or None
            subreddits.append(
                Subreddit(
                    name=subreddit_name,
                    members_count=data.get("subscribers") or 0,
                    description=description,
                )
            )
    logger.info(
        "Found %s subreddits",
        len(subreddits),
    )
    return subreddits


async def get_subreddit_rules(page: StagehandPage, subreddit: Subreddit) -> list[Rule]:
    logger.debug("Fetching rules for %s", subreddit.name)
    url = f"https://www.reddit.com/mod/{subreddit.name}/rules/"
    await page.route("**/*", block_images)
    await page.goto(url)
    await asyncio.sleep(3)  # Extra sleep just to be safe.

    extraction = cast(
        RulesExtraction,
        await page.extract(
            RULES_EXTRACTION_SYSTEM_PROMPT,
            schema=RulesExtraction,
        ),
    )
    rules = extraction.rules
    if rules is None:
        raise ValueError(f"Failed to extract rules for r/{subreddit.name}")

    # Log the rules if debug mode is enabled.
    logger.debug("Rules for r/%s", subreddit.name)
    for rule in rules:
        description = f" — {rule.description}" if rule.description else ""
        logger.debug("  • %s%s", rule.title, description)

    return rules


async def get_self_promotion_status(
    subreddit: Subreddit, rules: list[Rule]
) -> SelfPromotionExtraction:
    messages = [
        {
            "role": "system",
            "content": SELF_PROMOTION_EXTRACTION_SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": "\n".join(
                [
                    f"Rule: {rule.title} {f'— {rule.description}' if rule.description else ''}"
                    for rule in rules
                ]
            ),
        },
    ]
    response = await ai.openai_client.chat.completions.parse(
        model="gpt-5-nano",
        messages=messages,  # ty: ignore[invalid-argument-type] It's fine because the schema is correct.
        response_format=SelfPromotionExtraction,
        extra_headers={
            "Helicone-Property-Subreddit": subreddit.name,
        },
    )
    extraction = response.choices[0].message.parsed
    if not extraction:
        raise Exception("Failed to parse self-promotion status")
    logger.info(
        "Self-promotion status for r/%s: \n  Status: %s\n  Detail: %s",
        subreddit.name,
        extraction.self_promotion,
        extraction.justification,
    )
    return extraction
