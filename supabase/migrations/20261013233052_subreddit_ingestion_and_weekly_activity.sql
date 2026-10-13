-- Subscriber totals must never be interpreted as weekly activity.
alter table public.subreddits
    add column weekly_active_users bigint check (weekly_active_users >= 0),
    add column self_promotion_confidence double precision
        check (self_promotion_confidence between 0 and 1);
-- Keep the legacy column until the old production deployment is replaced.
alter table public.subreddits alter column members_count drop not null;
create unique index subreddits_name_lower_key on public.subreddits (lower(name));
create index subreddits_weekly_active_users_idx on public.subreddits (weekly_active_users);
create index subreddits_promotion_weekly_active_users_idx
    on public.subreddits (self_promotion, weekly_active_users);

grant select, insert, update on public.subreddits to service_role;
grant select, insert, delete on public.rules to service_role;

-- One transaction saves the complete snapshot and replaces obsolete rules.
create function public.save_subreddit_snapshot(p_mode text, p_snapshot jsonb, p_rules jsonb)
returns table (subreddit_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
    saved_id uuid;
    target_name text := p_snapshot->>'name';
begin
    if p_mode not in ('add', 'update') or p_mode is null then
        raise exception 'mode must be add or update';
    end if;
    if target_name is null or target_name !~ '^[A-Za-z0-9_]{2,21}$' then
        raise exception 'invalid subreddit name';
    end if;
    if jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules) = 0 then
        raise exception 'rules must be a nonempty array';
    end if;
    if p_snapshot->>'weekly_active_users' is null
       or p_snapshot->>'self_promotion_confidence' is null then
        raise exception 'weekly activity and confidence are required';
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
    delete from public.rules where rules.subreddit_id = saved_id;
    insert into public.rules (subreddit_id, title, description)
        select saved_id, rule.title, rule.description
        from jsonb_to_recordset(p_rules) as rule(title text, description text);
    return query select saved_id, case when p_mode = 'add' then 'added' else 'updated' end;
end;
$$;
revoke all on function public.save_subreddit_snapshot(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_subreddit_snapshot(text, jsonb, jsonb) to service_role;
