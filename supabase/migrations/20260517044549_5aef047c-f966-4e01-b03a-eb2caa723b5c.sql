
-- Lock down search_path on helper functions
create or replace function public.touch_updated_at()
returns trigger language plpgsql
security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- handle_new_user must stay SECURITY DEFINER (it's called by an auth.users trigger),
-- but revoke execute from public/authenticated so it can't be invoked via PostgREST.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Add a no-op restrictive policy on sms_opt_outs so the linter knows the empty
-- policy set is intentional (server-only via service role).
create policy "sms opt outs no client access"
  on public.sms_opt_outs for select to authenticated using (false);
