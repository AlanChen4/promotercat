-- Each query vector represents one normalized comma-separated term.
-- Keep the single-term RPC available while application deployments roll over.
create function public.match_subreddits_by_descriptions(
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
        select value::text::extensions.vector(4096) as embedding
        from jsonb_array_elements(query_embeddings)
    ), ranked as (
        select current.name, current.self_promotion,
            current.self_promotion_detail, current.weekly_active_users,
            scores.average_similarity
        from public.current_subreddits current
        cross join lateral (
            select avg(-(current.description_embedding <#> query.embedding))
                    as average_similarity,
                max(-(current.description_embedding <#> query.embedding))
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

revoke all on function public.match_subreddits_by_descriptions(jsonb, double precision)
    from public, anon, authenticated;
grant execute on function public.match_subreddits_by_descriptions(jsonb, double precision)
    to service_role;
