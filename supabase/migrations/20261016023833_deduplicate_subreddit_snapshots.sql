-- A content timestamp records a change, not the last successful check.
alter table public.subreddits add column last_refreshed_at timestamptz;
comment on column public.subreddits.last_refreshed_at is
    'Last successful full refresh, including checks that found unchanged content.';

-- Capture the last check before removing consecutive duplicate snapshots.
update public.subreddits s set last_refreshed_at = (
    select max(created_at) from public.subreddit_self_promotion_details
    where subreddit_id = s.id
);

-- Keep the first observation of each consecutive version, including A -> B -> A.
with versions as (
    select subreddit_id, created_at,
        row_number() over w as ordinal,
        description, description_embedding,
        lag(description) over w as previous_description,
        lag(description_embedding) over w as previous_embedding
    from public.subreddit_descriptions
    window w as (partition by subreddit_id order by created_at)
)
delete from public.subreddit_descriptions d using versions v
where d.subreddit_id = v.subreddit_id and d.created_at = v.created_at
    and v.ordinal > 1
    and v.description is not distinct from v.previous_description
    and v.description_embedding is not distinct from v.previous_embedding;

-- Rules share a snapshot with the classification; compare the entire ordered set.
with versions as (
    select d.subreddit_id, d.created_at,
        jsonb_build_array(d.self_promotion, d.self_promotion_detail,
            d.self_promotion_confidence, coalesce((
                select jsonb_agg(jsonb_build_array(r.title, r.description) order by r.position)
                from public.subreddit_rules r
                where r.subreddit_id = d.subreddit_id and r.created_at = d.created_at
            ), '[]'::jsonb)) as content
    from public.subreddit_self_promotion_details d
), consecutive as (
    select *, lag(content) over (partition by subreddit_id order by created_at) as previous
    from versions
)
delete from public.subreddit_self_promotion_details d using consecutive v
where d.subreddit_id = v.subreddit_id and d.created_at = v.created_at
    and v.content = v.previous;
-- The existing foreign key cascades deletion to duplicate rule rows.

-- Successful full refreshes and below-threshold activity checks both advance the queue.
create or replace function public.get_subreddits_due_for_refresh(p_limit int default 100)
returns table (name text)
language sql
security invoker
set search_path = public, pg_temp
as $$
    with checks as (
        select subreddit.id, subreddit.name,
            case when members.weekly_active_users < 2500
                then greatest(members.created_at, subreddit.last_refreshed_at)
                else subreddit.last_refreshed_at
            end as refreshed_at, members.weekly_active_users
        from public.subreddits subreddit
        left join lateral (
            select created_at, weekly_active_users from public.subreddit_members
            where subreddit_id = subreddit.id and weekly_active_users is not null
            order by created_at desc limit 1
        ) members on true
        where not subreddit.is_banned
    )
    select checks.name from checks
    where refreshed_at is null or refreshed_at < now() - interval '1 month'
    order by weekly_active_users desc nulls last, refreshed_at asc nulls first, id
    limit least(greatest(p_limit, 1), 100);
$$;
revoke all on function public.get_subreddits_due_for_refresh(int) from public, anon, authenticated;
grant execute on function public.get_subreddits_due_for_refresh(int) to service_role;

create or replace function public.save_subreddit_snapshot(p_mode text, p_snapshot jsonb, p_rules jsonb)
returns table (subreddit_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
    saved_id uuid;
    saved_at timestamptz;
    previous_description public.subreddit_descriptions%rowtype;
    previous_policy public.subreddit_self_promotion_details%rowtype;
    previous_rules jsonb;
    incoming_rules jsonb;
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
        if jsonb_typeof(p_rules) is distinct from 'array' then
            raise exception 'rules must be an array';
        end if;
        if jsonb_array_length(p_rules) = 0 and (
            p_snapshot->>'self_promotion' is distinct from 'unspecified'
            or p_snapshot->>'self_promotion_detail' is distinct from ''
        ) then
            raise exception 'empty rules require unspecified promotion and an empty detail';
        end if;
        -- Luna fallback decisions have no calibrated confidence; require the key
        -- but allow an explicit null instead of storing Jev's unrelated score.
        if not (p_snapshot ? 'self_promotion_confidence')
           or p_snapshot->>'self_promotion' is null
           or p_snapshot->>'self_promotion_detail' is null then
            raise exception 'promotion status, detail, and confidence are required';
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
    end if;
    if p_mode = 'add' then
        insert into public.subreddits (name) values (target_name)
        on conflict do nothing returning id into saved_id;
        if saved_id is null then
            select id into saved_id from public.subreddits where lower(name) = lower(target_name);
            if saved_id is null then raise exception 'insert failed'; end if;
            return query select saved_id, 'already_exists'::text;
            return;
        end if;
    else
        -- An activity-only discovery can track growth without inventing policy data.
        if p_mode = 'activity' then
            insert into public.subreddits (name) values (target_name) on conflict do nothing;
        end if;
        -- All timelines serialize on the stable subreddit identity row.
        select id into saved_id from public.subreddits
        where lower(name) = lower(target_name) for update;
        if saved_id is null then raise exception 'subreddit does not exist; use add'; end if;
    end if;
    -- Keep the identity flag in the same transaction as the snapshot. Missing
    -- visibility in cached Reddit layouts must not reset a known restriction.
    if p_snapshot ? 'is_restricted' then
        update public.subreddits
        set is_restricted = (p_snapshot->>'is_restricted')::boolean
        where id = saved_id;
    end if;
    saved_at := clock_timestamp();
    if p_mode <> 'activity' then
        -- Compare only after locking the identity row. A concurrent refresh must
        -- see the preceding writer's committed snapshot before deciding to insert.
        select * into previous_description from public.subreddit_descriptions d
        where d.subreddit_id = saved_id order by d.created_at desc limit 1;
        if previous_description.subreddit_id is null
           or previous_description.description is distinct from p_snapshot->>'description'
           or previous_description.description_embedding is distinct from
              (p_snapshot->>'description_embedding')::extensions.vector then
            insert into public.subreddit_descriptions
                (subreddit_id, created_at, description, description_embedding)
            values (saved_id, saved_at, p_snapshot->>'description',
                (p_snapshot->>'description_embedding')::extensions.vector);
        end if;
        select * into previous_policy from public.subreddit_self_promotion_details d
        where d.subreddit_id = saved_id order by d.created_at desc limit 1;
        select coalesce(jsonb_agg(jsonb_build_array(title, description) order by position), '[]'::jsonb)
        into previous_rules from public.subreddit_rules r
        where r.subreddit_id = saved_id and r.created_at = previous_policy.created_at;
        select coalesce(jsonb_agg(jsonb_build_array(value->>'title', value->>'description') order by position), '[]'::jsonb)
        into incoming_rules from jsonb_array_elements(p_rules) with ordinality as rule(value, position);
        if previous_policy.subreddit_id is null
           or previous_policy.self_promotion is distinct from
              (p_snapshot->>'self_promotion')::public.self_promotion_status
           or previous_policy.self_promotion_detail is distinct from p_snapshot->>'self_promotion_detail'
           or previous_policy.self_promotion_confidence is distinct from
              (p_snapshot->>'self_promotion_confidence')::double precision
           or previous_rules is distinct from incoming_rules then
            insert into public.subreddit_self_promotion_details
                (subreddit_id, created_at, self_promotion, self_promotion_detail, self_promotion_confidence)
            values
                (saved_id, saved_at, (p_snapshot->>'self_promotion')::public.self_promotion_status,
                 p_snapshot->>'self_promotion_detail',
                 (p_snapshot->>'self_promotion_confidence')::double precision);
            insert into public.subreddit_rules (subreddit_id, created_at, position, title, description)
            select saved_id, saved_at, rule.position::integer,
                rule.value->>'title', rule.value->>'description'
            from jsonb_array_elements(p_rules) with ordinality as rule(value, position);
        end if;
        update public.subreddits set last_refreshed_at = saved_at where id = saved_id;
    end if;
    insert into public.subreddit_members (subreddit_id, created_at, weekly_active_users)
    values (saved_id, saved_at, activity_count);
    return query select saved_id, case p_mode
        when 'add' then 'added'
        when 'activity' then 'activity_updated'
        else 'updated'
    end;
end;
$$;
revoke all on function public.save_subreddit_snapshot(text, jsonb, jsonb)
    from public, anon, authenticated;
grant execute on function public.save_subreddit_snapshot(text, jsonb, jsonb) to service_role;
