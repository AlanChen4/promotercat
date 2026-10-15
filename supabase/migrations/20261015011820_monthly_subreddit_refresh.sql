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
