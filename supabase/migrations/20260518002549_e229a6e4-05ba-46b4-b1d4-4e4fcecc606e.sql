
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamp with time zone not null default now(),
  last_seen_at timestamp with time zone not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions(user_id) where enabled;

alter table public.push_subscriptions enable row level security;

create policy "push self select" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push self insert" on public.push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push self update" on public.push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push self delete" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

alter table public.user_profile
  add column if not exists earned_badges jsonb not null default '[]'::jsonb;
