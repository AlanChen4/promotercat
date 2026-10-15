-- Create users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    email TEXT NOT NULL,
    stripe_customer_id TEXT,
    is_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable row level security
alter table public.users enable row level security;

-- Users table: only owner can select and update (no insert/delete)
create policy "Users can view their own user row"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "Users can update their own user row"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- inserts a row into public.users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;
-- trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();