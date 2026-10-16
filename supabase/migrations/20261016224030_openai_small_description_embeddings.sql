-- Backfill this column before deploying the OpenAI search path. Keep Qwen
-- vectors and RPCs available while application deployments roll over.
alter table public.subreddit_descriptions
    add column description_embedding_openai extensions.vector(1536);
comment on column public.subreddit_descriptions.description_embedding_openai is
    'Normalized openai/text-embedding-3-small (1536); input is name: description, without rules.';
grant update (description_embedding_openai) on public.subreddit_descriptions to service_role;

create or replace view public.current_subreddits with (security_invoker = true) as
select subreddit.id, subreddit.name,
    descriptions.description, descriptions.description_embedding,
    details.self_promotion, details.self_promotion_detail, details.self_promotion_confidence,
    members.weekly_active_users, subreddit.is_banned, subreddit.is_restricted, descriptions.description_embedding_openai
from public.subreddits subreddit
left join lateral (
    select description, description_embedding, description_embedding_openai from public.subreddit_descriptions
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

create function public.match_subreddits_by_descriptions_openai(
    query_embeddings jsonb,
    match_threshold double precision
)
returns jsonb
language sql
stable
security invoker
set search_path = public, extensions, pg_temp
as $$
    with query_vectors as materialized (
        select value::text::extensions.vector(1536) as embedding
        from jsonb_array_elements(query_embeddings)
    ), ranked as (
        select current.name, current.self_promotion,
            current.self_promotion_detail, current.weekly_active_users,
            scores.average_similarity
        from public.current_subreddits current
        cross join lateral (
            select avg(-(current.description_embedding_openai <#> query.embedding))
                    as average_similarity,
                max(-(current.description_embedding_openai <#> query.embedding))
                    as best_similarity
            from query_vectors query
        ) scores
        where current.self_promotion is not null
          and scores.best_similarity >= match_threshold
    )
    -- A scalar JSON result avoids PostgREST's row cap. Preserve every match
    -- before the application applies filters, explicit sorting, and pagination.
    select coalesce(jsonb_agg(
        jsonb_build_object(
            'name', name,
            'self_promotion', self_promotion,
            'self_promotion_detail', self_promotion_detail,
            'weekly_active_users', weekly_active_users
        ) order by average_similarity desc, name
    ), '[]'::jsonb)
    from ranked;
$$;

revoke all on function public.match_subreddits_by_descriptions_openai(jsonb, double precision)
    from public, anon, authenticated;
grant execute on function public.match_subreddits_by_descriptions_openai(jsonb, double precision)
    to service_role;

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
           or (p_snapshot ? 'description_embedding' and
               previous_description.description_embedding is distinct from
               (p_snapshot->>'description_embedding')::extensions.vector)
           or (p_snapshot ? 'description_embedding_openai' and
               previous_description.description_embedding_openai is distinct from
               (p_snapshot->>'description_embedding_openai')::extensions.vector) then
            insert into public.subreddit_descriptions
                (subreddit_id, created_at, description, description_embedding, description_embedding_openai)
            values (saved_id, saved_at, p_snapshot->>'description',
                case when p_snapshot ? 'description_embedding'
                    then (p_snapshot->>'description_embedding')::extensions.vector
                    when previous_description.description is not distinct from p_snapshot->>'description'
                    then previous_description.description_embedding end,
                case when p_snapshot ? 'description_embedding_openai'
                    then (p_snapshot->>'description_embedding_openai')::extensions.vector
                    when previous_description.description is not distinct from p_snapshot->>'description'
                    then previous_description.description_embedding_openai end);
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
