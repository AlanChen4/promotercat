-- Successful full refreshes and below-threshold activity checks both advance the queue.
create function public.get_subreddits_due_for_refresh(p_limit int default 350)
returns table (name text)
language sql
security invoker
set search_path = public, pg_temp
as $$
    with checks as (
        select subreddit.id, subreddit.name,
            case when members.weekly_active_users < 2500
                then greatest(members.created_at, details.created_at)
                else details.created_at
            end as refreshed_at, members.weekly_active_users
        from public.subreddits subreddit
        left join lateral (
            select created_at, weekly_active_users from public.subreddit_members
            where subreddit_id = subreddit.id and weekly_active_users is not null
            order by created_at desc limit 1
        ) members on true
        left join lateral (
            select created_at from public.subreddit_self_promotion_details
            where subreddit_id = subreddit.id
            order by created_at desc limit 1
        ) details on true
    )
    select checks.name from checks
    where refreshed_at is null or refreshed_at < now() - interval '1 month'
    order by weekly_active_users desc nulls last, refreshed_at asc nulls first, id
    limit least(greatest(p_limit, 1), 350);
$$;
revoke all on function public.get_subreddits_due_for_refresh(int) from public, anon, authenticated;
grant execute on function public.get_subreddits_due_for_refresh(int) to service_role;

-- Community size controls Apify usage, not visibility in search.
create or replace function public.match_subreddits_by_description(
    query_embedding extensions.vector(3072), match_threshold float, match_count int
)
returns table (
    name text, self_promotion public.self_promotion_status,
    self_promotion_detail text, weekly_active_users bigint
)
language sql
security invoker
set search_path = public, extensions, pg_temp
as $$
    select current.name, current.self_promotion, current.self_promotion_detail,
        current.weekly_active_users
    from public.current_subreddits current
    where current.description_embedding is not null
      and current.description_embedding <#> query_embedding < -match_threshold
    order by current.description_embedding <#> query_embedding asc
    limit least(match_count, 200);
$$;
