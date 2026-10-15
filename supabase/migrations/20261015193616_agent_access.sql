create table public.agent_api_quotas (
  account_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null default '-infinity',
  minute_count integer not null default 0 check (minute_count >= 0),
  day_start timestamptz not null default '-infinity',
  day_count integer not null default 0 check (day_count >= 0)
);
alter table public.agent_api_quotas enable row level security;
revoke all on public.agent_api_quotas from public, anon, authenticated;
grant select, insert, update, delete on public.agent_api_quotas to service_role;

create function public.admit_agent_request(p_account_id uuid)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  q public.agent_api_quotas;
  t timestamptz;
  m timestamptz;
  d timestamptz;
  reset_at timestamptz;
  exhausted text;
begin
  insert into public.agent_api_quotas(account_id) values (p_account_id)
    on conflict (account_id) do nothing;
  select * into strict q from public.agent_api_quotas where account_id = p_account_id for update;
  t := clock_timestamp();
  m := date_trunc('minute', t at time zone 'UTC') at time zone 'UTC';
  d := date_trunc('day', t at time zone 'UTC') at time zone 'UTC';
  if q.minute_start <> m then q.minute_count := 0; end if;
  if q.day_start <> d then q.day_count := 0; end if;
  if q.minute_count >= 30 then
    exhausted := 'minute'; reset_at := m + interval '1 minute';
  end if;
  if q.day_count >= 1000 then
    exhausted := case when exhausted is null then 'day' else 'minute_and_day' end;
    reset_at := d + interval '1 day';
  end if;
  if exhausted is not null then
    return jsonb_build_object('allowed', false, 'allowance', exhausted,
      'resetAt', reset_at, 'retryAfter', greatest(1, ceil(extract(epoch from reset_at - t))::integer));
  end if;
  update public.agent_api_quotas set minute_start = m, minute_count = q.minute_count + 1,
    day_start = d, day_count = q.day_count + 1 where account_id = p_account_id;
  return jsonb_build_object('allowed', true);
end;
$$;
revoke all on function public.admit_agent_request(uuid) from public, anon, authenticated;
grant execute on function public.admit_agent_request(uuid) to service_role;
create function public.is_active_agent_session(p_session_id uuid, p_account_id uuid, p_client_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.sessions s
    join auth.oauth_consents c on c.user_id = s.user_id and c.client_id = s.oauth_client_id
    join auth.oauth_clients oc on oc.id = s.oauth_client_id
    where s.id = p_session_id and s.user_id = p_account_id and s.oauth_client_id = p_client_id
      and c.revoked_at is null and oc.deleted_at is null
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function public.is_active_agent_session(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.is_active_agent_session(uuid, uuid, uuid) to service_role;
