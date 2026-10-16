-- Agent access tokens remain valid until expiry after revocation.
drop function public.is_active_agent_session(uuid, uuid, uuid);
