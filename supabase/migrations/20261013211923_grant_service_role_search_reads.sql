-- New Supabase images do not grant Data API access to new tables by default.
-- The search API reads these tables through its server-only service role.
grant select on table public.subreddits, public.rules to service_role;

grant execute on function public.match_subreddits_by_description(
    extensions.vector, double precision, integer
) to service_role;
