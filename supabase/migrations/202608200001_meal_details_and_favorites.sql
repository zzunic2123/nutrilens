-- Persist meal components, support reusable favourites, and keep every row user-owned.

alter table public.meals
  add column is_favorite boolean not null default false;

alter table public.meals
  drop constraint if exists meals_source_check;

alter table public.meals
  add constraint meals_source_check
  check (source in ('manual', 'text_ai', 'photo_ai', 'favorite'));

create index meals_user_favorites_idx
  on public.meals (user_id, updated_at desc)
  where is_favorite;

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals(id) on delete cascade,
  position smallint not null check (position between 0 and 100),
  name text not null check (char_length(name) between 1 and 160),
  estimated_grams numeric(8, 1) check (estimated_grams is null or estimated_grams between 0 and 10000),
  preparation text check (preparation is null or char_length(preparation) <= 500),
  created_at timestamptz not null default now(),
  unique (meal_id, position)
);

create index meal_items_meal_position_idx
  on public.meal_items (meal_id, position);

alter table public.meal_items enable row level security;

-- RLS policies only take effect after the authenticated role has the underlying
-- table privileges. Keep these grants explicit so fresh CLI-created databases
-- behave the same as dashboard-created projects.
grant select, insert, update, delete on table public.meals to authenticated;
grant select, insert, update, delete on table public.meal_items to authenticated;
grant select, insert, update on table public.profiles to authenticated;

create policy "Users can read items from their own meals"
on public.meal_items for select
to authenticated
using (
  exists (
    select 1
    from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
      and (select private.is_allowed_user())
  )
);

create policy "Users can create items for their own meals"
on public.meal_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
      and (select private.is_allowed_user())
  )
);

create policy "Users can update items from their own meals"
on public.meal_items for update
to authenticated
using (
  exists (
    select 1
    from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
      and (select private.is_allowed_user())
  )
)
with check (
  exists (
    select 1
    from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
      and (select private.is_allowed_user())
  )
);

create policy "Users can delete items from their own meals"
on public.meal_items for delete
to authenticated
using (
  exists (
    select 1
    from public.meals
    where meals.id = meal_items.meal_id
      and meals.user_id = (select auth.uid())
      and (select private.is_allowed_user())
  )
);

create or replace function public.create_meal_with_items(
  p_eaten_at timestamptz,
  p_title text,
  p_notes text,
  p_source text,
  p_calories_kcal numeric,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric,
  p_fiber_g numeric,
  p_ai_confidence text,
  p_is_favorite boolean,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_meal_id uuid;
begin
  insert into public.meals (
    user_id,
    eaten_at,
    title,
    notes,
    source,
    calories_kcal,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    ai_confidence,
    is_favorite
  ) values (
    (select auth.uid()),
    p_eaten_at,
    trim(p_title),
    nullif(trim(p_notes), ''),
    p_source,
    p_calories_kcal,
    p_protein_g,
    p_carbs_g,
    p_fat_g,
    p_fiber_g,
    p_ai_confidence,
    p_is_favorite
  )
  returning id into created_meal_id;

  insert into public.meal_items (
    meal_id,
    position,
    name,
    estimated_grams,
    preparation
  )
  select
    created_meal_id,
    (item.ordinality - 1)::smallint,
    trim(item.value ->> 'name'),
    nullif(item.value ->> 'estimatedGrams', '')::numeric,
    nullif(trim(item.value ->> 'preparation'), '')
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) with ordinality as item(value, ordinality);

  return created_meal_id;
end;
$$;

revoke all on function public.create_meal_with_items(
  timestamptz, text, text, text, numeric, numeric, numeric, numeric, numeric, text, boolean, jsonb
) from public, anon;
grant execute on function public.create_meal_with_items(
  timestamptz, text, text, text, numeric, numeric, numeric, numeric, numeric, text, boolean, jsonb
) to authenticated;

comment on table public.meal_items is
  'User-owned components detected or entered for a meal. Components are deleted with their meal.';

comment on table public.meals is
  'One confirmed aggregate nutrition record per meal with optional reusable favourite state.';

comment on column public.meals.is_favorite is
  'Marks a logged meal as a reusable favourite template.';

comment on function public.create_meal_with_items(
  timestamptz, text, text, text, numeric, numeric, numeric, numeric, numeric, text, boolean, jsonb
) is 'Atomically creates one user-owned meal and its ordered components.';
