-- Local development test account. No subreddit fixtures.

begin;

-- Local-only credentials match the development sign-in button.
insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
    email_change_token_new, email_change, created_at, updated_at
)
values (
    '00000000-0000-0000-0000-000000000000',
    'c47c47c4-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'miso@promotercat.local',
    extensions.crypt('promotercat-local-only', extensions.gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}', '{"name":"Miso"}',
    '', '', '', '', now(), now()
)
on conflict (id) do nothing;

insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
values (
    'c47c47c4-0000-4000-8000-000000000001',
    'c47c47c4-0000-4000-8000-000000000001',
    '{"sub":"c47c47c4-0000-4000-8000-000000000001","email":"miso@promotercat.local","email_verified":true}',
    'email', now(), now()
)
on conflict (provider_id, provider) do nothing;

commit;
