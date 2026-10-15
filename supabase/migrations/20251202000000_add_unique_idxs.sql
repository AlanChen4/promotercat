-- Ensure idempotent subreddit upserts by name
create unique index if not exists subreddits_name_key on public.subreddits (name);

-- Ensure rules are unique per subreddit for upserts (title + description)
create unique index if not exists rules_subreddit_id_title_description_key on public.rules (subreddit_id, title, description);
