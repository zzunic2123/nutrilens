import type { User } from '@supabase/supabase-js'
import type {
  AnalysisInput,
  ChampionRecord,
  LeaderboardEntry,
  LeaderboardOverview,
  LeaderboardPeriod,
  Meal,
  MealAnalysis,
  MealDraft,
  MealItem,
  PlayerMealTimeline,
  Profile,
  PublicMeal,
  PublicMealCursor,
} from '../types'
import { DEFAULT_GOALS, APP_TIMEZONE } from '../lib/constants'
import { supabase } from '../lib/supabase'

interface MealRow {
  id: string
  user_id: string
  eaten_at: string
  title: string
  notes: string | null
  source: Meal['source']
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  ai_confidence: Meal['confidence']
  is_favorite: boolean
  created_at: string
  updated_at: string
  meal_items?: MealItemRow[] | null
}

interface MealItemRow {
  id: string
  meal_id: string
  position: number
  name: string
  estimated_grams: number | null
  preparation: string | null
  created_at: string
}

interface ProfileRow {
  id: string
  email: string
  display_name: string
  daily_calories_target: number
  daily_protein_target_g: number
  daily_carbs_target_g: number
  daily_fat_target_g: number
  daily_fiber_target_g: number
  timezone: string
  push_enabled: boolean
}

function mapMealItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    mealId: row.meal_id,
    position: row.position,
    name: row.name,
    estimatedGrams: row.estimated_grams == null ? null : Number(row.estimated_grams),
    preparation: row.preparation,
    createdAt: row.created_at,
  }
}

function mapMeal(row: MealRow): Meal {
  return {
    id: row.id,
    userId: row.user_id,
    eatenAt: row.eaten_at,
    title: row.title,
    notes: row.notes,
    source: row.source,
    nutrition: {
      calories: Number(row.calories_kcal),
      protein: Number(row.protein_g),
      carbs: Number(row.carbs_g),
      fat: Number(row.fat_g),
      fiber: row.fiber_g == null ? null : Number(row.fiber_g),
    },
    confidence: row.ai_confidence,
    items: (row.meal_items ?? []).map(mapMealItem).sort((a, b) => a.position - b.position),
    isFavorite: row.is_favorite ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    timezone: row.timezone,
    pushEnabled: row.push_enabled,
    goals: {
      calories: Number(row.daily_calories_target),
      protein: Number(row.daily_protein_target_g),
      carbs: Number(row.daily_carbs_target_g),
      fat: Number(row.daily_fat_target_g),
      fiber: Number(row.daily_fiber_target_g),
    },
  }
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

function mapLeaderboardEntry(entry: LeaderboardEntry): LeaderboardEntry {
  return {
    ...entry,
    rank: Number(entry.rank),
    protein: Number(entry.protein),
    calories: Number(entry.calories),
    loggedDays: Number(entry.loggedDays),
    mealCount: Number(entry.mealCount),
    score: entry.score == null ? null : Number(entry.score),
    eligible: Boolean(entry.eligible),
    isCurrentUser: Boolean(entry.isCurrentUser),
  }
}

function mapChampion(champion: ChampionRecord): ChampionRecord {
  return {
    ...champion,
    score: Number(champion.score),
    protein: Number(champion.protein),
    calories: Number(champion.calories),
    loggedDays: Number(champion.loggedDays),
  }
}

function mapPublicMeal(meal: PublicMeal): PublicMeal {
  return {
    ...meal,
    nutrition: {
      calories: Number(meal.nutrition.calories),
      protein: Number(meal.nutrition.protein),
      carbs: Number(meal.nutrition.carbs),
      fat: Number(meal.nutrition.fat),
      fiber: meal.nutrition.fiber == null ? null : Number(meal.nutrition.fiber),
    },
    items: meal.items.map((item) => ({
      ...item,
      estimatedGrams: item.estimatedGrams == null ? null : Number(item.estimatedGrams),
    })),
  }
}

export async function fetchMeals(): Promise<Meal[]> {
  const client = requireClient()
  const pageSize = 500
  const rows: MealRow[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from('meals')
      .select('*, meal_items(*)')
      .order('eaten_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const page = data as MealRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows.map(mapMeal)
}

export async function fetchProfile(user: User): Promise<Profile> {
  const client = requireClient()
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (data) return mapProfile(data as ProfileRow)

  const fallback = {
    id: user.id,
    email: user.email ?? '',
    display_name: user.user_metadata.full_name ?? user.email?.split('@')[0] ?? 'NutriLens user',
    daily_calories_target: DEFAULT_GOALS.calories,
    daily_protein_target_g: DEFAULT_GOALS.protein,
    daily_carbs_target_g: DEFAULT_GOALS.carbs,
    daily_fat_target_g: DEFAULT_GOALS.fat,
    daily_fiber_target_g: DEFAULT_GOALS.fiber,
    timezone: APP_TIMEZONE,
  }
  const { data: inserted, error: insertError } = await client
    .from('profiles')
    .insert(fallback)
    .select('*')
    .single()
  if (insertError) throw insertError
  return mapProfile(inserted as ProfileRow)
}

export async function createMeal(userId: string, draft: MealDraft): Promise<Meal> {
  const client = requireClient()
  const { data: mealId, error } = await client.rpc('create_meal_with_items', {
    p_eaten_at: draft.eatenAt,
    p_title: draft.title,
    p_notes: draft.notes ?? '',
    p_source: draft.source,
    p_calories_kcal: draft.nutrition.calories,
    p_protein_g: draft.nutrition.protein,
    p_carbs_g: draft.nutrition.carbs,
    p_fat_g: draft.nutrition.fat,
    p_fiber_g: draft.nutrition.fiber,
    p_ai_confidence: draft.confidence,
    p_is_favorite: draft.isFavorite,
    p_items: draft.items,
  })
  if (error) throw error
  if (typeof mealId !== 'string') throw new Error('The meal was created without an identifier.')

  const { data, error: readError } = await client
    .from('meals')
    .select('*, meal_items(*)')
    .eq('id', mealId)
    .eq('user_id', userId)
    .single()
  if (readError) throw readError
  return mapMeal(data as MealRow)
}

export async function removeMeal(id: string): Promise<void> {
  const { error } = await requireClient().from('meals').delete().eq('id', id)
  if (error) throw error
}

export async function updateMealFavorite(id: string, isFavorite: boolean): Promise<Meal> {
  const { data, error } = await requireClient()
    .from('meals')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
    .select('*, meal_items(*)')
    .single()
  if (error) throw error
  return mapMeal(data as MealRow)
}

export async function updateProfile(user: User, profile: Profile): Promise<Profile> {
  const { data, error } = await requireClient()
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email ?? profile.email,
      display_name: profile.displayName.trim(),
      daily_calories_target: profile.goals.calories,
      daily_protein_target_g: profile.goals.protein,
      daily_carbs_target_g: profile.goals.carbs,
      daily_fat_target_g: profile.goals.fat,
      daily_fiber_target_g: profile.goals.fiber,
      timezone: profile.timezone,
      push_enabled: profile.pushEnabled,
    }, { onConflict: 'id' })
    .select('*')
    .single()
  if (error) throw error
  return mapProfile(data as ProfileRow)
}

export async function fetchLeaderboard(
  period: LeaderboardPeriod,
  historyOffset = 0,
): Promise<LeaderboardOverview> {
  const { data, error } = await requireClient().rpc('get_leaderboard', {
    p_period_type: period,
    p_history_offset: historyOffset,
    p_history_limit: 50,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('The leaderboard returned no result.')
  const overview = data as LeaderboardOverview
  return {
    ...overview,
    period,
    entries: (overview.entries ?? []).map(mapLeaderboardEntry),
    latestWeekChampions: (overview.latestWeekChampions ?? []).map(mapChampion),
    latestMonthChampions: (overview.latestMonthChampions ?? []).map(mapChampion),
    championHistory: (overview.championHistory ?? []).map(mapChampion),
    historyHasMore: Boolean(overview.historyHasMore),
  }
}

export async function fetchLeaderboardPlayerMeals(
  userId: string,
  period: LeaderboardPeriod,
  periodStart: string | null = null,
  cursor: PublicMealCursor | null = null,
): Promise<PlayerMealTimeline> {
  const { data, error } = await requireClient().rpc('get_leaderboard_player_meals', {
    p_player_id: userId,
    p_period_type: period,
    p_period_start: periodStart,
    p_before_eaten_at: cursor?.eatenAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: 50,
  })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('The Player meal view returned no result.')
  const timeline = data as PlayerMealTimeline
  return {
    ...timeline,
    period,
    meals: (timeline.meals ?? []).map(mapPublicMeal),
    hasMore: Boolean(timeline.hasMore),
    nextCursor: timeline.nextCursor ?? null,
  }
}

export async function analyzeMeal(input: AnalysisInput): Promise<MealAnalysis> {
  const { data, error } = await requireClient().functions.invoke<MealAnalysis>('analyze-meal', {
    body: input,
  })
  if (error) {
    let message = error.message || 'Meal analysis failed.'
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      try {
        const body = await context.clone().json() as { error?: unknown }
        if (typeof body.error === 'string') message = body.error
      } catch {
        // Retain the SDK message when the function did not return JSON.
      }
    }
    throw new Error(message)
  }
  if (!data) throw new Error('The analysis returned no result.')
  return data
}

export async function savePushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('The browser returned an incomplete push subscription.')
  }
  const { error } = await requireClient().from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const { error } = await requireClient().from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}
