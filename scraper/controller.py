import asyncio
from typing import cast

import httpx
from bs4 import BeautifulSoup
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

    async with httpx.AsyncClient() as client:
        community_page_response = await client.get(url)
        soup = BeautifulSoup(community_page_response.text, "html.parser")
        community_list = soup.find("div", class_="community-list")
        for community in community_list.find_all("div"):
            subreddit_name = community.find("a").attrs["href"].split("/")[-2]
            if subreddit_name in seen_subreddit_names:
                continue
            description = community.find(
                "h6",
                class_="flex-grow h-md text-12 truncate py-[0.125rem] w-[11rem] m-0",
            ).text.strip()
            seen_subreddit_names.add(subreddit_name)
            members_count = community.find("faceplate-number").attrs["number"]
            subreddits.append(
                Subreddit(
                    name=subreddit_name,
                    members_count=members_count,
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
        model="gpt-5-mini/openai",
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
