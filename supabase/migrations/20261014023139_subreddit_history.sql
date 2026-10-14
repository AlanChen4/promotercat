-- One observation per successful scrape; rules are NULL for activity-only saves.
create table public.subreddit_history (
    subreddit_id uuid not null references public.subreddits(id) on delete cascade,
    observed_at timestamptz not null default clock_timestamp(),
    weekly_active_users bigint check (weekly_active_users >= 0),
    rules jsonb check (jsonb_typeof(rules) = 'array'),
    primary key (subreddit_id, observed_at)
);

alter table public.subreddit_history enable row level security;
revoke all on public.subreddit_history from public, anon, authenticated, service_role;
grant select, insert on public.subreddit_history to service_role;

-- Establish today's baseline, not a reconstructed scrape date. Activity-only writes
-- previously did not update last_scraped_at. Preserve unknown activity as NULL.
insert into public.subreddit_history (subreddit_id, observed_at, weekly_active_users, rules)
select subreddits.id, statement_timestamp(), subreddits.weekly_active_users,
    coalesce(jsonb_agg(jsonb_build_object(
        'title', rules.title, 'description', rules.description
    ) order by rules.title, rules.description) filter (where rules.id is not null), '[]'::jsonb)
from public.subreddits
left join public.rules on rules.subreddit_id = subreddits.id
group by subreddits.id;

-- All save modes record history in the same transaction as the current data.
create or replace function public.save_subreddit_snapshot(p_mode text, p_snapshot jsonb, p_rules jsonb)
returns table (subreddit_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
    saved_id uuid;
    target_name text := p_snapshot->>'name';
begin
    if p_mode not in ('add', 'update', 'activity') or p_mode is null then
        raise exception 'mode must be add, update, or activity';
    end if;
    if target_name is null or target_name !~ '^[A-Za-z0-9_]{2,21}$' then
        raise exception 'invalid subreddit name';
    end if;
    if p_snapshot->>'weekly_active_users' is null then
        raise exception 'weekly activity is required';
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
    end if;
    if p_mode = 'add' then
        insert into public.subreddits
            (name, weekly_active_users, description, description_embedding,
             self_promotion, self_promotion_detail, self_promotion_confidence, last_scraped_at)
        values
            (target_name, (p_snapshot->>'weekly_active_users')::bigint,
             p_snapshot->>'description', (p_snapshot->>'description_embedding')::extensions.vector,
             (p_snapshot->>'self_promotion')::public.self_promotion_status,
             p_snapshot->>'self_promotion_detail',
             (p_snapshot->>'self_promotion_confidence')::double precision, now())
        on conflict do nothing returning id into saved_id;
        if saved_id is null then
            select id into saved_id from public.subreddits where lower(name) = lower(target_name);
            if saved_id is null then raise exception 'insert failed'; end if;
            return query select saved_id, 'already_exists'::text;
            return;
        end if;
    elsif p_mode = 'activity' then
        update public.subreddits set
            weekly_active_users = (p_snapshot->>'weekly_active_users')::bigint
        where lower(name) = lower(target_name) returning id into saved_id;
        if saved_id is null then raise exception 'subreddit does not exist; use add'; end if;
    else
        update public.subreddits set
            weekly_active_users = (p_snapshot->>'weekly_active_users')::bigint,
            description = p_snapshot->>'description',
            description_embedding = (p_snapshot->>'description_embedding')::extensions.vector,
            self_promotion = (p_snapshot->>'self_promotion')::public.self_promotion_status,
            self_promotion_detail = p_snapshot->>'self_promotion_detail',
            self_promotion_confidence = (p_snapshot->>'self_promotion_confidence')::double precision,
            last_scraped_at = now()
        where lower(name) = lower(target_name) returning id into saved_id;
        if saved_id is null then raise exception 'subreddit does not exist; use add'; end if;
    end if;
    if p_mode <> 'activity' then
        delete from public.rules where rules.subreddit_id = saved_id;
        insert into public.rules (subreddit_id, title, description)
            select saved_id, rule.title, rule.description
            from jsonb_to_recordset(p_rules) as rule(title text, description text);
    end if;
    -- Read the saved state, not the input, so history matches current rows exactly.
    insert into public.subreddit_history (subreddit_id, weekly_active_users, rules)
    select saved_id, subreddits.weekly_active_users,
        case when p_mode = 'activity' then null else (
            select coalesce(jsonb_agg(jsonb_build_object(
                'title', rules.title, 'description', rules.description
            ) order by rules.title, rules.description), '[]'::jsonb)
            from public.rules where rules.subreddit_id = saved_id
        ) end
    from public.subreddits where id = saved_id;
    return query select saved_id, case p_mode
        when 'add' then 'added'
        when 'activity' then 'activity_updated'
        else 'updated'
    end;
end;
$$;
revoke all on function public.save_subreddit_snapshot(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_subreddit_snapshot(text, jsonb, jsonb) to service_role;
