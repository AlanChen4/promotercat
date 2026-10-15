-- Keep descriptions, promotion policies/rules, and weekly activity on separate timelines.
create table public.subreddit_descriptions (
    subreddit_id uuid not null references public.subreddits(id) on delete cascade,
    created_at timestamptz not null default clock_timestamp(),
    description text,
    description_embedding extensions.vector(3072),
    primary key (subreddit_id, created_at)
);
create table public.subreddit_self_promotion_details (
    subreddit_id uuid not null references public.subreddits(id) on delete cascade,
    created_at timestamptz not null default clock_timestamp(),
    self_promotion public.self_promotion_status not null,
    self_promotion_detail text not null,
    self_promotion_confidence double precision check (self_promotion_confidence between 0 and 1),
    primary key (subreddit_id, created_at)
);
create table public.subreddit_members (
    subreddit_id uuid not null references public.subreddits(id) on delete cascade,
    created_at timestamptz not null default clock_timestamp(),
    weekly_active_users bigint check (weekly_active_users >= 0),
    primary key (subreddit_id, created_at)
);
create table public.subreddit_rules (
    subreddit_id uuid not null,
    created_at timestamptz not null,
    position integer not null check (position > 0),
    title text not null,
    description text,
    primary key (subreddit_id, created_at, position),
    foreign key (subreddit_id, created_at)
        references public.subreddit_self_promotion_details(subreddit_id, created_at) on delete cascade
);
-- Position preserves historical array order and repeated titles without extra UUIDs.
alter table public.subreddit_descriptions enable row level security;
alter table public.subreddit_self_promotion_details enable row level security;
alter table public.subreddit_members enable row level security;
alter table public.subreddit_rules enable row level security;
revoke all on public.subreddit_descriptions, public.subreddit_self_promotion_details, public.subreddit_members, public.subreddit_rules
    from public, anon, authenticated, service_role;
grant select, insert on public.subreddit_descriptions, public.subreddit_self_promotion_details, public.subreddit_members, public.subreddit_rules
    to service_role;

-- Preserve the last known metadata and rules before removing current-value storage.
-- Subscriber totals are not weekly activity; leave old activity unknown.
insert into public.subreddit_descriptions
    (subreddit_id, created_at, description, description_embedding)
select id, coalesce(last_scraped_at, statement_timestamp()), description, description_embedding
from public.subreddits;
insert into public.subreddit_self_promotion_details
    (subreddit_id, created_at, self_promotion, self_promotion_detail)
select id, coalesce(last_scraped_at, statement_timestamp()), self_promotion, self_promotion_detail
from public.subreddits;
insert into public.subreddit_members (subreddit_id, created_at)
select id, statement_timestamp() from public.subreddits;
insert into public.subreddit_rules (subreddit_id, created_at, position, title, description)
select rule.subreddit_id, details.created_at,
    row_number() over (partition by rule.subreddit_id order by rule.title, rule.description, rule.id)::integer,
    rule.title, rule.description
from public.rules rule
join public.subreddit_self_promotion_details details on details.subreddit_id = rule.subreddit_id;

drop function public.match_subreddits_by_description(extensions.vector, double precision, integer);
drop table public.rules;
alter table public.subreddits
    drop column members_count,
    drop column last_scraped_at,
    drop column description,
    drop column description_embedding,
    drop column self_promotion,
    drop column self_promotion_detail;
drop index public.subreddits_name_key;
create unique index subreddits_name_lower_key on public.subreddits (lower(name));
revoke all on public.subreddits from public, anon, authenticated, service_role;
-- UPDATE permits the row lock that serializes snapshot writes.
grant select, insert, update on public.subreddits to service_role;

create view public.current_subreddits with (security_invoker = true) as
select subreddit.id, subreddit.name,
    descriptions.description, descriptions.description_embedding,
    details.self_promotion, details.self_promotion_detail, details.self_promotion_confidence,
    members.weekly_active_users
from public.subreddits subreddit
left join lateral (
    select description, description_embedding from public.subreddit_descriptions
    where subreddit_id = subreddit.id
    order by created_at desc limit 1
) descriptions on true
left join lateral (
    select * from public.subreddit_self_promotion_details
    where subreddit_id = subreddit.id
    order by created_at desc limit 1
) details on true
left join lateral (
    select weekly_active_users from public.subreddit_members
    where subreddit_id = subreddit.id
    order by created_at desc limit 1
) members on true;
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
    select current.name, current.self_promotion, current.self_promotion_detail,
        current.weekly_active_users
    from public.current_subreddits current
    where current.description_embedding is not null
      and current.description_embedding <#> query_embedding < -match_threshold
    order by current.description_embedding <#> query_embedding asc
    limit least(match_count, 200);
$$;
revoke all on function public.match_subreddits_by_description(extensions.vector, double precision, integer)
    from public, anon, authenticated;
grant execute on function public.match_subreddits_by_description(extensions.vector, double precision, integer)
    to service_role;

create function public.save_subreddit_snapshot(p_mode text, p_snapshot jsonb, p_rules jsonb)
returns table (subreddit_id uuid, outcome text)
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
    saved_id uuid;
    saved_at timestamptz;
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
        if p_snapshot->>'self_promotion_confidence' is null
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
    saved_at := clock_timestamp();
    if p_mode <> 'activity' then
        insert into public.subreddit_descriptions
            (subreddit_id, created_at, description, description_embedding)
        values (saved_id, saved_at, p_snapshot->>'description',
            (p_snapshot->>'description_embedding')::extensions.vector);
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

-- Supabase Auth owns user accounts; the old billing profile is unused.
drop trigger on_auth_user_created on auth.users;
drop function public.handle_new_user();
drop table public.users;
