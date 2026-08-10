-- NutriLens initial schema
-- One confirmed row per meal; AI-detected components are never persisted separately.

create extension if not exists pgcrypto;

create table public.allowed_users (
  email text primary key check (email = lower(trim(email))),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  daily_calories_target numeric(7, 1) not null default 2200 check (daily_calories_target between 500 and 10000),
  daily_protein_target_g numeric(7, 1) not null default 140 check (daily_protein_target_g between 1 and 1000),
  daily_carbs_target_g numeric(7, 1) not null default 245 check (daily_carbs_target_g between 1 and 1500),
  daily_fat_target_g numeric(7, 1) not null default 70 check (daily_fat_target_g between 1 and 1000),
  daily_fiber_target_g numeric(7, 1) not null default 30 check (daily_fiber_target_g between 1 and 300),
  timezone text not null default 'Europe/Zagreb',
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  eaten_at timestamptz not null,
  title text not null check (char_length(title) between 1 and 160),
  notes text check (notes is null or char_length(notes) <= 2000),
  source text not null check (source in ('manual', 'text_ai', 'photo_ai')),
  calories_kcal numeric(8, 1) not null check (calories_kcal between 0 and 20000),
  protein_g numeric(8, 1) not null check (protein_g between 0 and 2000),
  carbs_g numeric(8, 1) not null check (carbs_g between 0 and 2000),
  fat_g numeric(8, 1) not null check (fat_g between 0 and 2000),
  fiber_g numeric(8, 1) check (fiber_g is null or fiber_g between 0 and 1000),
  ai_confidence text check (ai_confidence is null or ai_confidence in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meals_user_eaten_at_idx on public.meals (user_id, eaten_at desc);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input_type text not null check (input_type in ('text', 'photo')),
  model text not null,
  openai_request_id text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  status text not null check (status in ('success', 'refused', 'incomplete', 'error', 'rate_limited')),
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_at_idx on public.ai_usage (user_id, created_at desc);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 4000),
  p256dh text not null check (char_length(p256dh) <= 500),
  auth text not null check (char_length(auth) <= 500),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  notification text not null check (notification in ('breakfast', 'lunch', 'dinner', 'daily_report', 'weekly_report')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_code text,
  attempted_at timestamptz,
  sent_at timestamptz,
  unique (subscription_id, notification, scheduled_for)
);

create index notification_deliveries_scheduled_idx
  on public.notification_deliveries (scheduled_for desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger meals_set_updated_at
before update on public.meals
for each row execute function public.set_updated_at();

create or replace function public.is_allowed_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.allowed_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_allowed_user() from public;
grant execute on function public.is_allowed_user() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'NutriLens user'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.allowed_users enable row level security;
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.ai_usage enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

-- The allowlist is administered only through the dashboard, migrations, or service role.
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id and public.is_allowed_user());

create policy "Allowed users can create their own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id and public.is_allowed_user());

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id and public.is_allowed_user())
with check (auth.uid() = id and public.is_allowed_user());

create policy "Users can read their own meals"
on public.meals for select
to authenticated
using (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can create their own meals"
on public.meals for insert
to authenticated
with check (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can update their own meals"
on public.meals for update
to authenticated
using (auth.uid() = user_id and public.is_allowed_user())
with check (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can delete their own meals"
on public.meals for delete
to authenticated
using (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can read their own AI usage"
on public.ai_usage for select
to authenticated
using (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can read their own push subscriptions"
on public.push_subscriptions for select
to authenticated
using (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can create their own push subscriptions"
on public.push_subscriptions for insert
to authenticated
with check (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can update their own push subscriptions"
on public.push_subscriptions for update
to authenticated
using (auth.uid() = user_id and public.is_allowed_user())
with check (auth.uid() = user_id and public.is_allowed_user());

create policy "Users can delete their own push subscriptions"
on public.push_subscriptions for delete
to authenticated
using (auth.uid() = user_id and public.is_allowed_user());

-- notification_deliveries has no client policies. The reminder function owns it.

comment on table public.meals is 'One confirmed aggregate nutrition record per meal; no food-component table.';
comment on table public.notification_deliveries is 'Operational idempotency records, not user reminder preferences.';
