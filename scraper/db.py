from datetime import datetime, timedelta, timezone

from google.genai import types as genai_types

from ai import gemini_client
from env import environment
from logger import get_logger
from schemas import Rule, SelfPromotionExtraction, Subreddit
from supabase import Client, create_client

logger = get_logger(__name__)

client: Client = create_client(str(environment.SUPABASE_URL), environment.SUPABASE_KEY)


def is_subreddit_scraped_at_before(subreddit_name: str, *, hours: int) -> bool:
    response = (
        client.table("subreddits")
        .select("last_scraped_at")
        .eq("name", subreddit_name)
        .limit(1)
        .execute()
    )
    data = response.data or []
    if not data:
        return False

    last_scraped_at = data[0].get("last_scraped_at")
    if not last_scraped_at:
        return False

    parsed = (
        datetime.fromisoformat(last_scraped_at.replace("Z", "+00:00"))
        if isinstance(last_scraped_at, str)
        else last_scraped_at
    )

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)

    time_since_scrape = datetime.now(timezone.utc) - parsed
    return time_since_scrape < timedelta(hours=hours)


async def update_subreddit_metadata(subreddit: Subreddit) -> None:
    logger.info("Updating subreddit metadata for r/%s", subreddit.name)
    description_embedding: list[float] | None = None
    existing_description_response = (
        client.table("subreddits")
        .select("description")
        .eq("name", subreddit.name)
        .limit(1)
        .execute()
    )
    should_create_embedding = (
        subreddit.description
        and existing_description_response.data
        and subreddit.description
        != existing_description_response.data[0].get("description")
    )
    if should_create_embedding:
        logger.info(
            "Embedding description for r/%s with text '%s'",
            subreddit.name,
            subreddit.description,
        )
        embedding_response = gemini_client.models.embed_content(
            model="gemini-embedding-001",
            contents=[f"r/{subreddit.name}: {subreddit.description}"],
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT"),
        )
        if embedding_response.embeddings:
            description_embedding = embedding_response.embeddings[0].values

    payload = {
        "description": subreddit.description,
        "members_count": subreddit.members_count,
    }
    if description_embedding:
        payload["description_embedding"] = description_embedding

    client.table("subreddits").update(payload).eq("name", subreddit.name).execute()


async def upsert_subreddit_with_rules(
    subreddit: Subreddit,
    rules: list[Rule],
    self_promotion_extraction: SelfPromotionExtraction,
) -> None:
    """Save the subreddit self-promotion status and associated rules to the database."""
    subreddit_payload = {
        "name": subreddit.name,
        "self_promotion": self_promotion_extraction.self_promotion,
        "self_promotion_detail": self_promotion_extraction.justification_short,
        "members_count": subreddit.members_count,
        "last_scraped_at": datetime.now(timezone.utc).isoformat(),
    }

    subreddit_response = (
        client.table("subreddits")
        .upsert(subreddit_payload, on_conflict="name")
        .execute()
    )
    if not subreddit_response.data:
        raise ValueError(f"Supabase returned no data for r/{subreddit.name}")

    subreddit_id = subreddit_response.data[0]["id"]

    if len(rules) == 0:
        return

    seen = set()
    unique_rules = []
    for rule in rules:
        key = (rule.title, rule.description, subreddit_id)
        if key not in seen:
            seen.add(key)
            unique_rules.append(rule)

    upsert_response = (
        client.table("rules")
        .upsert(
            [
                {
                    "title": rule.title,
                    "description": rule.description,
                    "subreddit_id": subreddit_id,
                }
                for rule in unique_rules
            ],
            on_conflict="subreddit_id,title,description",
        )
        .execute()
    )
    rule_ids = [row["id"] for row in upsert_response.data or []]

    # Delete any rules that were previously stored but not returned in the latest snapshot.
    if rule_ids:
        client.table("rules").delete().eq("subreddit_id", subreddit_id).not_.in_(
            "id", rule_ids
        ).execute()
