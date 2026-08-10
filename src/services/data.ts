import type { User } from '@supabase/supabase-js'
import type { AnalysisInput, Meal, MealAnalysis, MealDraft, Profile } from '../types'
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
  created_at: string
  updated_at: string
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

export async function fetchMeals(): Promise<Meal[]> {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await requireClient()
    .from('meals')
    .select('*')
    .gte('eaten_at', since)
    .order('eaten_at', { ascending: false })
  if (error) throw error
  return (data as MealRow[]).map(mapMeal)
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
  const { data, error } = await requireClient()
    .from('meals')
    .insert({
      user_id: userId,
      eaten_at: draft.eatenAt,
      title: draft.title.trim(),
      notes: draft.notes?.trim() || null,
      source: draft.source,
      calories_kcal: draft.nutrition.calories,
      protein_g: draft.nutrition.protein,
      carbs_g: draft.nutrition.carbs,
      fat_g: draft.nutrition.fat,
      fiber_g: draft.nutrition.fiber,
      ai_confidence: draft.confidence,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapMeal(data as MealRow)
}

export async function removeMeal(id: string): Promise<void> {
  const { error } = await requireClient().from('meals').delete().eq('id', id)
  if (error) throw error
}

export async function updateProfile(profile: Profile): Promise<Profile> {
  const { data, error } = await requireClient()
    .from('profiles')
    .update({
      display_name: profile.displayName.trim(),
      daily_calories_target: profile.goals.calories,
      daily_protein_target_g: profile.goals.protein,
      daily_carbs_target_g: profile.goals.carbs,
      daily_fat_target_g: profile.goals.fat,
      daily_fiber_target_g: profile.goals.fiber,
      timezone: profile.timezone,
      push_enabled: profile.pushEnabled,
    })
    .eq('id', profile.id)
    .select('*')
    .single()
  if (error) throw error
  return mapProfile(data as ProfileRow)
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
