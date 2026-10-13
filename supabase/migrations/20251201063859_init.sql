-- Enum for self-promotion status
create type self_promotion_status as enum (
    'not_allowed',
    'unspecified',
    'allowed_full',
    'allowed_limited'
);

-- Subreddits table
create table if not exists subreddits (
    id uuid primary key default extensions.uuid_generate_v4(),
    name text not null,
    self_promotion self_promotion_status not null,
    self_promotion_detail text not null,
    members_count bigint not null,
    last_scraped_at timestamp with time zone
);

-- Rules table
create table if not exists rules (
    id uuid primary key default extensions.uuid_generate_v4(),
    title text not null,
    description text,
    subreddit_id uuid not null references subreddits(id) on delete cascade
);

-- RLS policies
-- Do NOT allow read access. Only service account can read data.
alter table subreddits enable row level security;
alter table rules enable row level security;
