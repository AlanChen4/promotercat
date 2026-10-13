create extension if not exists vector with schema extensions;

alter table public.subreddits
    add column if not exists description text;

alter table public.subreddits
    add column if not exists description_embedding extensions.vector(3072);

create or replace function public.match_subreddits_by_description(
    query_embedding extensions.vector(3072),
    match_threshold float,
    match_count int
) returns setof public.subreddits
language sql
set search_path = public, extensions, pg_temp
as $$
    select *
    from public.subreddits
    where description_embedding is not null
      and description_embedding <#> query_embedding < -match_threshold
    order by description_embedding <#> query_embedding asc
    limit least(match_count, 200);
$$;

