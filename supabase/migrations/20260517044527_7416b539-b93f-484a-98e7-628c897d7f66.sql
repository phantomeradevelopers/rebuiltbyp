
-- =========================================================
-- REBUILT member app schema
-- =========================================================

-- Helper: updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- user_profile ----------
create table public.user_profile (
  user_id uuid primary key,
  email text not null,
  first_name text,
  phone_e164 text,
  age integer,
  height_cm numeric,
  weight_kg numeric,
  goal_weight_kg numeric,
  goals jsonb not null default '[]'::jsonb,
  equipment_access text,
  training_days_per_week integer,
  session_minutes integer,
  preferred_training_days jsonb not null default '[]'::jsonb,
  foods_liked text,
  foods_avoided text,
  allergies jsonb not null default '[]'::jsonb,
  dietary_pattern text,
  sleep_hours numeric,
  stress_level integer,
  alcohol_per_week integer,
  caffeine_per_day integer,
  medications text,
  injuries text,
  screener_conditions jsonb not null default '[]'::jsonb,
  screener_passed boolean,
  notification_email boolean not null default true,
  notification_sms boolean not null default false,
  notification_push boolean not null default true,
  reminder_time_local time not null default '06:00',
  daily_motivation_enabled boolean not null default true,
  sms_consent_at timestamptz,
  rebuilt_access boolean not null default false,
  rebuilt_start_date date,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profile enable row level security;
create policy "profile self select" on public.user_profile for select using (auth.uid() = user_id);
create policy "profile self insert" on public.user_profile for insert with check (auth.uid() = user_id);
create policy "profile self update" on public.user_profile for update using (auth.uid() = user_id);
create trigger user_profile_touch before update on public.user_profile
  for each row execute function public.touch_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profile (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- user_plans ----------
create table public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_type text not null check (plan_type in ('workout','nutrition','combined')),
  plan_data jsonb not null,
  active boolean not null default true,
  generated_at timestamptz not null default now()
);
alter table public.user_plans enable row level security;
create policy "plans self all" on public.user_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index user_plans_user_idx on public.user_plans(user_id, active);

-- ---------- daily_checkins ----------
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  date date not null,
  mood integer check (mood between 1 and 10),
  energy integer check (energy between 1 and 10),
  sleep_hours numeric,
  stress integer check (stress between 1 and 10),
  workout_completed boolean,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
alter table public.daily_checkins enable row level security;
create policy "checkins self all" on public.daily_checkins for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- weight_log ----------
create table public.weight_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  weight_kg numeric not null,
  logged_at timestamptz not null default now()
);
alter table public.weight_log enable row level security;
create policy "weight self all" on public.weight_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- progress_photos ----------
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  photo_url text not null,
  view_type text check (view_type in ('front','side','back')),
  logged_at timestamptz not null default now()
);
alter table public.progress_photos enable row level security;
create policy "photos self all" on public.progress_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- daily content tables ----------
create table public.daily_affirmations (
  id serial primary key,
  content text not null,
  category text
);
alter table public.daily_affirmations enable row level security;
create policy "affirmations read all auth" on public.daily_affirmations for select to authenticated using (true);

create table public.daily_lessons (
  id serial primary key,
  title text not null,
  content text not null,
  module_tie text
);
alter table public.daily_lessons enable row level security;
create policy "lessons read all auth" on public.daily_lessons for select to authenticated using (true);

create table public.daily_quotes (
  id serial primary key,
  content text not null,
  context text
);
alter table public.daily_quotes enable row level security;
create policy "quotes read all auth" on public.daily_quotes for select to authenticated using (true);

-- ---------- user_content_history ----------
create table public.user_content_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  content_type text not null check (content_type in ('affirmation','lesson','quote')),
  content_id integer not null,
  delivered_at timestamptz not null default now()
);
alter table public.user_content_history enable row level security;
create policy "history self all" on public.user_content_history for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index content_history_user_idx on public.user_content_history(user_id, content_type, delivered_at desc);

-- ---------- notification_queue ----------
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null check (channel in ('email','sms','push')),
  type text not null,
  subject text,
  body text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  error_message text,
  created_at timestamptz not null default now()
);
alter table public.notification_queue enable row level security;
create policy "notif self select" on public.notification_queue for select using (auth.uid() = user_id);
-- writes happen server-side
create index notif_pending_idx on public.notification_queue(status, scheduled_for) where status = 'pending';

-- ---------- sms_opt_outs (server-only) ----------
create table public.sms_opt_outs (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  opted_out_at timestamptz not null default now()
);
alter table public.sms_opt_outs enable row level security;
-- no policies = no client access

-- ---------- AI coach ----------
create table public.ai_coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
alter table public.ai_coach_conversations enable row level security;
create policy "convo self all" on public.ai_coach_conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.ai_coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_coach_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_coach_messages enable row level security;
create policy "messages self select" on public.ai_coach_messages for select using (
  exists (select 1 from public.ai_coach_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
create policy "messages self insert" on public.ai_coach_messages for insert with check (
  exists (select 1 from public.ai_coach_conversations c where c.id = conversation_id and c.user_id = auth.uid())
);
create index messages_convo_idx on public.ai_coach_messages(conversation_id, created_at);
