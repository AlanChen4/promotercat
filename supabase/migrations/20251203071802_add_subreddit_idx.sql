-- Improve subreddit lookups for filtering/sorting in /subreddits API
create index if not exists subreddits_members_count_idx
    on public.subreddits (members_count);

-- Optimize combined filters on self-promotion status + member range
create index if not exists subreddits_self_promotion_members_count_idx
    on public.subreddits (self_promotion, members_count);
