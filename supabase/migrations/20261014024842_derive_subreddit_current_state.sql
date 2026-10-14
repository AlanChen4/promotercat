-- The previous migration preserves current activity and rules as history baselines.
-- Dropping members_count also removes both obsolete indexes that depend on it.
drop function public.match_subreddits_by_description(extensions.vector, double precision, integer);
alter table public.subreddits
    drop column members_count,
    drop column weekly_active_users,
    drop column last_scraped_at;
drop table public.rules;

-- This view stores nothing. Its current values come from the latest observations.
create view public.current_subreddits with (security_invoker = true) as
select subreddits.*,
    activity.weekly_active_users,
    policy.observed_at as last_scraped_at,
    policy.rules
from public.subreddits
left join lateral (
    select weekly_active_users
    from public.subreddit_history
    where subreddit_id = subreddits.id
    order by observed_at desc limit 1
) activity on true
left join lateral (
    select observed_at, rules
    from public.subreddit_history
    where subreddit_id = subreddits.id and rules is not null
    order by observed_at desc limit 1
) policy on true;
revoke all on public.current_subreddits from public, anon, authenticated, service_role;
grant select on public.current_subreddits to service_role;

create function public.match_subreddits_by_description(
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
    with matches as (
        select id, description_embedding <#> query_embedding as distance
        from public.subreddits
        where description_embedding is not null
          and description_embedding <#> query_embedding < -match_threshold
        order by distance asc limit least(match_count, 200)
    )
    select current.name, current.self_promotion, current.self_promotion_detail,
        current.weekly_active_users
    from matches
    join public.current_subreddits current on current.id = matches.id
    order by matches.distance asc;
$$;
revoke all on function public.match_subreddits_by_description(extensions.vector, double precision, integer)
    from public, anon, authenticated;
grant execute on function public.match_subreddits_by_description(extensions.vector, double precision, integer)
    to service_role;

-- Full saves update metadata and append rules; activity saves append only a count.
create or replace function public.save_subreddit_snapshot(p_mode text, p_snapshot jsonb, p_rules jsonb)
returns table (subreddit_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
    saved_id uuid;
    saved_rules jsonb;
    target_name text := p_snapshot->>'name';
    activity_count bigint := (p_snapshot->>'weekly_active_users')::bigint;
begin
    if p_mode not in ('add', 'update', 'activity') or p_mode is null then
        raise exception 'mode must be add, update, or activity';
    end if;
    if target_name is null or target_name !~ '^[A-Za-z0-9_]{2,21}$' then
        raise exception 'invalid subreddit name';
    end if;
    if activity_count is null or activity_count < 0 then
        raise exception 'nonnegative weekly activity is required';
    end if;
    if p_mode = 'activity' then
        if p_rules is not null then
            raise exception 'activity updates must not include rules';
        end if;
    else
        if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) = 0 then
            raise exception 'rules must be a nonempty array';
        end if;
        if p_snapshot->>'self_promotion_confidence' is null then
            raise exception 'confidence is required';
        end if;
        if exists (
            select 1 from jsonb_to_recordset(p_rules) as rule(title text, description text)
            where rule.title is null
        ) then
            raise exception 'rule titles are required';
        end if;
        if exists (
            select 1 from jsonb_to_recordset(p_rules) as rule(title text, description text)
            group by rule.title, rule.description having count(*) > 1
        ) then
            raise exception 'rules must not contain duplicates';
        end if;
        select jsonb_agg(jsonb_build_object('title', rule.title, 'description', rule.description)
            order by rule.title, rule.description) into saved_rules
        from jsonb_to_recordset(p_rules) as rule(title text, description text);
    end if;
    if p_mode = 'add' then
        insert into public.subreddits
            (name, description, description_embedding,
             self_promotion, self_promotion_detail, self_promotion_confidence)
        values
            (target_name, p_snapshot->>'description',
             (p_snapshot->>'description_embedding')::extensions.vector,
             (p_snapshot->>'self_promotion')::public.self_promotion_status,
             p_snapshot->>'self_promotion_detail',
             (p_snapshot->>'self_promotion_confidence')::double precision)
        on conflict do nothing returning id into saved_id;
        if saved_id is null then
            select id into saved_id from public.subreddits where lower(name) = lower(target_name);
            if saved_id is null then raise exception 'insert failed'; end if;
            return query select saved_id, 'already_exists'::text;
            return;
        end if;
    elsif p_mode = 'activity' then
        -- Serialize observations with full saves, including their history timestamps.
        select id into saved_id from public.subreddits
        where lower(name) = lower(target_name) for update;
        if saved_id is null then raise exception 'subreddit does not exist; use add'; end if;
    else
        update public.subreddits set
            description = p_snapshot->>'description',
            description_embedding = (p_snapshot->>'description_embedding')::extensions.vector,
            self_promotion = (p_snapshot->>'self_promotion')::public.self_promotion_status,
            self_promotion_detail = p_snapshot->>'self_promotion_detail',
            self_promotion_confidence = (p_snapshot->>'self_promotion_confidence')::double precision
        where lower(name) = lower(target_name) returning id into saved_id;
        if saved_id is null then raise exception 'subreddit does not exist; use add'; end if;
    end if;
    insert into public.subreddit_history (subreddit_id, weekly_active_users, rules)
    values (saved_id, activity_count, saved_rules);
    return query select saved_id, case p_mode
        when 'add' then 'added'
        when 'activity' then 'activity_updated'
        else 'updated'
    end;
end;
$$;
