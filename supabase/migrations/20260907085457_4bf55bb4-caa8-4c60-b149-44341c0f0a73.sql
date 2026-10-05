alter table public.user_profile add column if not exists is_demo boolean not null default false;
update public.user_profile set is_demo = true where email like '%@rebuilt.test' and is_demo = false;

create table if not exists public.qa_login_attempts (
  ip text primary key,
  attempts integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);
grant all on public.qa_login_attempts to service_role;
alter table public.qa_login_attempts enable row level security;