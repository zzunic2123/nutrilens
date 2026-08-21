-- Add a sanitized closed-group leaderboard and immutable weekly/monthly Champions.

create table public.leaderboard_periods (
  id uuid primary key default gen_random_uuid(),
  period_type text not null check (period_type in ('week', 'month')),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  declared_at timestamptz not null default now(),
  unique (period_type, period_start)
);

create table public.leaderboard_champions (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.leaderboard_periods(id) on delete cascade,
  player_id uuid references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 100),
  protein_efficiency numeric(12, 4) not null check (protein_efficiency >= 0),
  protein_g numeric(12, 1) not null check (protein_g >= 0),
  calories_kcal numeric(12, 1) not null check (calories_kcal > 0),
  logged_days smallint not null check (logged_days > 0),
  created_at timestamptz not null default now(),
  unique (period_id, player_id)
);

create index leaderboard_periods_history_idx
  on public.leaderboard_periods (period_end desc, period_type);

create index leaderboard_champions_period_idx
  on public.leaderboard_champions (period_id);

alter table public.leaderboard_periods enable row level security;
alter table public.leaderboard_champions enable row level security;

revoke all on table public.leaderboard_periods, public.leaderboard_champions
from public, anon, authenticated, service_role;

create or replace function private.leaderboard_stats(
  p_period_type text,
  p_period_start date,
  p_period_end date
)
returns table (
  player_id uuid,
  display_name text,
  protein_g numeric,
  calories_kcal numeric,
  logged_days integer,
  meal_count integer,
  protein_efficiency numeric,
  eligible boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with players as (
    select profile.id, profile.display_name
    from public.profiles as profile
    join auth.users as auth_user on auth_user.id = profile.id
    join public.allowed_users as allowed
      on allowed.email = lower(coalesce(auth_user.email, ''))
  ), totals as (
    select
      player.id as player_id,
      player.display_name,
      coalesce(sum(meal.protein_g), 0)::numeric as protein_g,
      coalesce(sum(meal.calories_kcal), 0)::numeric as calories_kcal,
      count(distinct ((meal.eaten_at at time zone 'Europe/Zagreb')::date))::integer as logged_days,
      count(meal.id)::integer as meal_count
    from players as player
    left join public.meals as meal
      on meal.user_id = player.id
      and meal.eaten_at >= (p_period_start::timestamp at time zone 'Europe/Zagreb')
      and meal.eaten_at < ((p_period_end + 1)::timestamp at time zone 'Europe/Zagreb')
    group by player.id, player.display_name
  )
  select
    totals.player_id,
    totals.display_name,
    totals.protein_g,
    totals.calories_kcal,
    totals.logged_days,
    totals.meal_count,
    case
      when totals.calories_kcal > 0
        then totals.protein_g / totals.calories_kcal * 1000
      else null
    end as protein_efficiency,
    case
      when totals.calories_kcal <= 0 then false
      when p_period_type = 'week' then totals.logged_days >= 4
      when p_period_type = 'month' then totals.logged_days >= 15
      else true
    end as eligible
  from totals;
$$;

revoke all on function private.leaderboard_stats(text, date, date)
from public, anon, authenticated;

create or replace function private.declare_leaderboard_period(
  p_period_type text,
  p_period_start date,
  p_period_end date
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_period_id uuid;
begin
  insert into public.leaderboard_periods (period_type, period_start, period_end)
  values (p_period_type, p_period_start, p_period_end)
  on conflict (period_type, period_start) do nothing
  returning id into created_period_id;

  if created_period_id is null then
    return false;
  end if;

  with eligible_players as (
    select *
    from private.leaderboard_stats(p_period_type, p_period_start, p_period_end)
    where eligible
  ), ranked_players as (
    select
      eligible_players.*,
      dense_rank() over (
        order by
          protein_efficiency desc,
          protein_g desc,
          logged_days desc,
          calories_kcal asc
      ) as winner_rank
    from eligible_players
  )
  insert into public.leaderboard_champions (
    period_id,
    player_id,
    display_name,
    protein_efficiency,
    protein_g,
    calories_kcal,
    logged_days
  )
  select
    created_period_id,
    player_id,
    display_name,
    protein_efficiency,
    protein_g,
    calories_kcal,
    logged_days
  from ranked_players
  where winner_rank = 1;

  return true;
end;
$$;

revoke all on function private.declare_leaderboard_period(text, date, date)
from public, anon, authenticated;

create or replace function private.declare_missing_leaderboard_periods()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  earliest_day date;
  current_day date := (now() at time zone 'Europe/Zagreb')::date;
  current_week_start date;
  current_month_start date;
  cursor_start date;
  cursor_end date;
  declarations integer := 0;
begin
  select min((meal.eaten_at at time zone 'Europe/Zagreb')::date)
  into earliest_day
  from public.meals as meal
  join auth.users as auth_user on auth_user.id = meal.user_id
  join public.allowed_users as allowed
    on allowed.email = lower(coalesce(auth_user.email, ''));

  if earliest_day is null then
    return 0;
  end if;

  current_week_start := current_day - (extract(isodow from current_day)::integer - 1);
  cursor_start := earliest_day - (extract(isodow from earliest_day)::integer - 1);
  while cursor_start < current_week_start loop
    if private.declare_leaderboard_period('week', cursor_start, cursor_start + 6) then
      declarations := declarations + 1;
    end if;
    cursor_start := cursor_start + 7;
  end loop;

  current_month_start := date_trunc('month', current_day)::date;
  cursor_start := date_trunc('month', earliest_day)::date;
  while cursor_start < current_month_start loop
    cursor_end := (cursor_start + interval '1 month')::date - 1;
    if private.declare_leaderboard_period('month', cursor_start, cursor_end) then
      declarations := declarations + 1;
    end if;
    cursor_start := (cursor_start + interval '1 month')::date;
  end loop;

  return declarations;
end;
$$;

revoke all on function private.declare_missing_leaderboard_periods()
from public, anon, authenticated;

create or replace function public.declare_leaderboard_champions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Leaderboard declaration requires the service role.'
      using errcode = '42501';
  end if;
  return private.declare_missing_leaderboard_periods();
end;
$$;

revoke all on function public.declare_leaderboard_champions()
from public, anon, authenticated;
grant execute on function public.declare_leaderboard_champions() to service_role;

create or replace function private.leaderboard_champion_json(
  p_champion public.leaderboard_champions,
  p_period public.leaderboard_periods
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', (p_champion).id,
    'period', (p_period).period_type,
    'startKey', (p_period).period_start,
    'endKey', (p_period).period_end,
    'userId', case when exists (
      select 1
      from auth.users as champion_user
      join public.allowed_users as champion_allowed
        on champion_allowed.email = lower(coalesce(champion_user.email, ''))
      where champion_user.id = (p_champion).player_id
    ) then (p_champion).player_id else null end,
    'displayName', (p_champion).display_name,
    'score', (p_champion).protein_efficiency,
    'protein', (p_champion).protein_g,
    'calories', (p_champion).calories_kcal,
    'loggedDays', (p_champion).logged_days,
    'declaredAt', (p_period).declared_at
  );
$$;

revoke all on function private.leaderboard_champion_json(
  public.leaderboard_champions,
  public.leaderboard_periods
) from public, anon, authenticated, service_role;

create or replace function public.get_leaderboard(
  p_period_type text,
  p_history_offset integer default 0,
  p_history_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_day date := (now() at time zone 'Europe/Zagreb')::date;
  period_start date;
  period_end date;
  entries jsonb;
  latest_week jsonb;
  latest_month jsonb;
  history jsonb;
  history_has_more boolean;
begin
  if (select auth.uid()) is null or not (select private.is_allowed_user()) then
    raise exception 'Leaderboard access denied.' using errcode = '42501';
  end if;
  if p_period_type not in ('today', 'week', 'month') then
    raise exception 'Unsupported leaderboard period.' using errcode = '22023';
  end if;
  if p_history_offset < 0 or p_history_limit < 1 or p_history_limit > 100 then
    raise exception 'Invalid Champion History page.' using errcode = '22023';
  end if;

  perform private.declare_missing_leaderboard_periods();

  if p_period_type = 'today' then
    period_start := current_day;
    period_end := current_day;
  elsif p_period_type = 'week' then
    period_start := current_day - (extract(isodow from current_day)::integer - 1);
    period_end := period_start + 6;
  else
    period_start := date_trunc('month', current_day)::date;
    period_end := (period_start + interval '1 month')::date - 1;
  end if;

  with ranked as (
    select
      leaderboard_stats.*,
      rank() over (
        order by
          protein_efficiency desc nulls last,
          protein_g desc,
          logged_days desc,
          calories_kcal asc
      ) as rank_position
    from private.leaderboard_stats(p_period_type, period_start, period_end)
      as leaderboard_stats
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', player_id,
        'displayName', display_name,
        'protein', protein_g,
        'calories', calories_kcal,
        'loggedDays', logged_days,
        'mealCount', meal_count,
        'score', protein_efficiency,
        'eligible', eligible,
        'rank', rank_position,
        'isCurrentUser', player_id = (select auth.uid())
      ) order by
        rank_position,
        display_name
    ),
    '[]'::jsonb
  )
  into entries
  from ranked;

  select coalesce(jsonb_agg(champion order by champion ->> 'displayName', champion ->> 'id'), '[]'::jsonb)
  into latest_week
  from (
    select private.leaderboard_champion_json(champion, period) as champion
    from public.leaderboard_champions as champion
    join public.leaderboard_periods as period on period.id = champion.period_id
    where period.period_type = 'week'
      and period.period_start = (
        select max(latest.period_start)
        from public.leaderboard_periods as latest
        where latest.period_type = 'week'
      )
  ) as latest;

  select coalesce(jsonb_agg(champion order by champion ->> 'displayName', champion ->> 'id'), '[]'::jsonb)
  into latest_month
  from (
    select private.leaderboard_champion_json(champion, period) as champion
    from public.leaderboard_champions as champion
    join public.leaderboard_periods as period on period.id = champion.period_id
    where period.period_type = 'month'
      and period.period_start = (
        select max(latest.period_start)
        from public.leaderboard_periods as latest
        where latest.period_type = 'month'
      )
  ) as latest;

  with ordered_champions as (
    select
      period.period_end as end_key,
      period.period_type,
      champion.display_name,
      champion.id as champion_id,
      private.leaderboard_champion_json(champion, period) as champion,
      row_number() over (
        order by period.period_end desc, period.period_type, champion.display_name, champion.id
      ) as history_position
    from public.leaderboard_champions as champion
    join public.leaderboard_periods as period on period.id = champion.period_id
  )
  select
    coalesce(
      jsonb_agg(champion order by end_key desc, period_type, display_name, champion_id)
        filter (where history_position <= p_history_offset + p_history_limit),
      '[]'::jsonb
    ),
    count(*) > p_history_limit
  into history, history_has_more
  from ordered_champions
  where history_position > p_history_offset
    and history_position <= p_history_offset + p_history_limit + 1;

  return jsonb_build_object(
    'period', p_period_type,
    'startKey', period_start,
    'endKey', period_end,
    'entries', entries,
    'latestWeekChampions', latest_week,
    'latestMonthChampions', latest_month,
    'championHistory', history,
    'historyHasMore', history_has_more
  );
end;
$$;

revoke all on function public.get_leaderboard(text, integer, integer)
from public, anon;
grant execute on function public.get_leaderboard(text, integer, integer)
to authenticated;

create or replace function public.get_leaderboard_player_meals(
  p_player_id uuid,
  p_period_type text,
  p_period_start date default null,
  p_before_eaten_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_day date := (now() at time zone 'Europe/Zagreb')::date;
  current_period_start date;
  selected_start date;
  selected_end date;
  player_name text;
  public_meals jsonb;
  meals_have_more boolean;
  next_cursor jsonb;
begin
  if (select auth.uid()) is null or not (select private.is_allowed_user()) then
    raise exception 'Leaderboard access denied.' using errcode = '42501';
  end if;
  if p_period_type not in ('today', 'week', 'month') then
    raise exception 'Unsupported leaderboard period.' using errcode = '22023';
  end if;
  if (p_before_eaten_at is null) <> (p_before_id is null)
     or p_limit < 1 or p_limit > 100 then
    raise exception 'Invalid Public Meal View page.' using errcode = '22023';
  end if;

  select profile.display_name
  into player_name
  from public.profiles as profile
  join auth.users as auth_user on auth_user.id = profile.id
  join public.allowed_users as allowed
    on allowed.email = lower(coalesce(auth_user.email, ''))
  where profile.id = p_player_id;

  if player_name is null then
    raise exception 'Player is not available.' using errcode = '22023';
  end if;

  if p_period_type = 'today' then
    current_period_start := current_day;
    selected_end := current_day;
  elsif p_period_type = 'week' then
    current_period_start := current_day - (extract(isodow from current_day)::integer - 1);
    selected_end := current_period_start + 6;
  else
    current_period_start := date_trunc('month', current_day)::date;
    selected_end := (current_period_start + interval '1 month')::date - 1;
  end if;
  selected_start := coalesce(p_period_start, current_period_start);

  if selected_start <> current_period_start then
    select period.period_end
    into selected_end
    from public.leaderboard_periods as period
    join public.leaderboard_champions as champion on champion.period_id = period.id
    where period.period_type = p_period_type
      and period.period_start = selected_start
      and champion.player_id = p_player_id;

    if selected_end is null then
      raise exception 'Historical meal access is limited to a Champion winning period.'
        using errcode = '42501';
    end if;
  end if;

  with meal_page as (
    select
      meal.*
    from public.meals as meal
    where meal.user_id = p_player_id
      and meal.eaten_at >= (selected_start::timestamp at time zone 'Europe/Zagreb')
      and meal.eaten_at < ((selected_end + 1)::timestamp at time zone 'Europe/Zagreb')
      and (
        p_before_eaten_at is null
        or (meal.eaten_at, meal.id) < (p_before_eaten_at, p_before_id)
      )
    order by meal.eaten_at desc, meal.id desc
    limit p_limit + 1
  ), public_rows as (
    select
      meal.id as meal_id,
      meal.eaten_at,
      row_number() over (order by meal.eaten_at desc, meal.id desc) as meal_position,
      jsonb_build_object(
        'id', meal.id,
        'userId', meal.user_id,
        'eatenAt', meal.eaten_at,
        'title', meal.title,
        'nutrition', jsonb_build_object(
          'calories', meal.calories_kcal,
          'protein', meal.protein_g,
          'carbs', meal.carbs_g,
          'fat', meal.fat_g,
          'fiber', meal.fiber_g
        ),
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', item.id,
              'name', item.name,
              'estimatedGrams', item.estimated_grams,
              'preparation', item.preparation
            ) order by item.position
          )
          from public.meal_items as item
          where item.meal_id = meal.id
        ), '[]'::jsonb)
      ) as public_meal
    from meal_page as meal
  )
  select
    coalesce(
      jsonb_agg(public_meal order by eaten_at desc, meal_id desc)
        filter (where meal_position <= p_limit),
      '[]'::jsonb
    ),
    count(*) > p_limit,
    case when count(*) > p_limit then (
      select jsonb_build_object('eatenAt', cursor_row.eaten_at, 'id', cursor_row.meal_id)
      from public_rows as cursor_row
      where cursor_row.meal_position = p_limit
    ) else null end
  into public_meals, meals_have_more, next_cursor
  from public_rows;

  return jsonb_build_object(
    'userId', p_player_id,
    'displayName', player_name,
    'period', p_period_type,
    'startKey', selected_start,
    'endKey', selected_end,
    'meals', public_meals,
    'hasMore', meals_have_more,
    'nextCursor', next_cursor
  );
end;
$$;

revoke all on function public.get_leaderboard_player_meals(
  uuid, text, date, timestamptz, uuid, integer
)
from public, anon;
grant execute on function public.get_leaderboard_player_meals(
  uuid, text, date, timestamptz, uuid, integer
)
to authenticated;

comment on table public.leaderboard_periods is
  'Immutable declarations for closed weekly and monthly Zagreb competition periods.';

comment on table public.leaderboard_champions is
  'First-place snapshots for declared periods; meal details are never copied.';

comment on function public.get_leaderboard(text, integer, integer) is
  'Returns sanitized current standings and immutable Champion history to an allowlisted Player.';

comment on function public.get_leaderboard_player_meals(
  uuid, text, date, timestamptz, uuid, integer
) is
  'Returns a period-scoped Public Meal View without notes, email, favourites, or AI metadata.';

-- Populate Champion History for every completed eligible period already represented by meals.
select private.declare_missing_leaderboard_periods();
