-- Keep authorization helpers out of the exposed API schema and optimize RLS checks.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter function public.is_allowed_user() set schema private;
alter function public.handle_new_user() set schema private;

create or replace function private.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users
    where email = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
$$;

revoke all on function private.is_allowed_user() from public, anon, authenticated;
grant execute on function private.is_allowed_user() to authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

revoke all on table public.allowed_users, public.notification_deliveries
from anon, authenticated;

create index allowed_users_invited_by_idx on public.allowed_users (invited_by);

alter policy "Users can read their own profile"
on public.profiles
using ((select auth.uid()) = id and (select private.is_allowed_user()));

alter policy "Allowed users can create their own profile"
on public.profiles
with check ((select auth.uid()) = id and (select private.is_allowed_user()));

alter policy "Users can update their own profile"
on public.profiles
using ((select auth.uid()) = id and (select private.is_allowed_user()))
with check ((select auth.uid()) = id and (select private.is_allowed_user()));

alter policy "Users can read their own meals"
on public.meals
using ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can create their own meals"
on public.meals
with check ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can update their own meals"
on public.meals
using ((select auth.uid()) = user_id and (select private.is_allowed_user()))
with check ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can delete their own meals"
on public.meals
using ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can read their own AI usage"
on public.ai_usage
using ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can read their own push subscriptions"
on public.push_subscriptions
using ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can create their own push subscriptions"
on public.push_subscriptions
with check ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can update their own push subscriptions"
on public.push_subscriptions
using ((select auth.uid()) = user_id and (select private.is_allowed_user()))
with check ((select auth.uid()) = user_id and (select private.is_allowed_user()));

alter policy "Users can delete their own push subscriptions"
on public.push_subscriptions
using ((select auth.uid()) = user_id and (select private.is_allowed_user()));

