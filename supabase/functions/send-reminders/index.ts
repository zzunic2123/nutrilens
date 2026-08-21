import { createClient } from 'npm:@supabase/supabase-js@2.109.0'
import webpush from 'npm:web-push@3.6.7'
import { projectCredentials } from '../_shared/project-env.ts'

const TIMEZONE = 'Europe/Zagreb'
const APP_URL = Deno.env.get('APP_URL') ?? 'http://localhost:5173/'

type ReminderType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'daily_report'
  | 'weekly_report'

interface SubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface MealRow {
  eaten_at: string
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
    weekday: value('weekday'),
  }
}

function dueReminder(now: Date): ReminderType | null {
  const local = localParts(now)
  if (local.time === '09:00') return 'breakfast'
  if (local.time === '13:00') return 'lunch'
  if (local.time === '19:00') return 'dinner'
  if (local.time === '21:00') return 'daily_report'
  if (local.weekday === 'Sun' && local.time === '20:00') return 'weekly_report'
  return null
}

function dateKey(iso: string): string {
  return localParts(new Date(iso)).date
}

function shiftKey(key: string, amount: number): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function aggregate(meals: MealRow[]) {
  return meals.reduce(
    (total, meal) => ({
      calories: total.calories + Number(meal.calories_kcal),
      protein: total.protein + Number(meal.protein_g),
      carbs: total.carbs + Number(meal.carbs_g),
      fat: total.fat + Number(meal.fat_g),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { url: supabaseUrl, secretKey } = projectCredentials()
  if (!supabaseUrl || !secretKey) {
    return Response.json({ error: 'Supabase service credentials are not configured.' }, {
      status: 503,
    })
  }
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: championPeriodsDeclared, error: championError } = await supabase
    .rpc('declare_leaderboard_champions')
  if (championError) {
    console.error('Champion declaration failed:', championError.message)
  }
  const championDeclarationError = championError?.message ?? null

  const now = new Date()
  const reminder = dueReminder(now)
  if (!reminder) {
    return Response.json({
      status: 'no_reminder_due',
      championPeriodsDeclared,
      championDeclarationError,
    })
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return Response.json({ error: 'Reminder service is not configured.' }, {
      status: 503,
    })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
  if (subscriptionError) {
    return Response.json({ error: subscriptionError.message }, { status: 500 })
  }
  if (!subscriptions?.length) {
    return Response.json({
      status: 'no_subscriptions',
      championPeriodsDeclared,
      championDeclarationError,
      sent: 0,
    })
  }

  const userIds = [
    ...new Set(
      (subscriptions as SubscriptionRow[]).map((subscription) => subscription.user_id),
    ),
  ]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id,display_name,push_enabled')
    .in('id', userIds)
    .eq('push_enabled', true)
  const enabledUsers = new Map(
    (profiles ?? []).map((
      profile,
    ) => [profile.id as string, profile.display_name as string]),
  )
  const reportCache = new Map<
    string,
    { title: string; body: string; url: string }
  >()
  const scheduledFor = new Date(Math.floor(now.getTime() / 300_000) * 300_000)
    .toISOString()

  const payloadFor = async (userId: string) => {
    const cached = reportCache.get(userId)
    if (cached) return cached
    const name = (enabledUsers.get(userId) ?? '').split(/\s+/)[0]
    const localToday = localParts(now).date
    let payload = {
      title: 'NutriLens',
      body: 'A gentle moment to log what you ate.',
      url: `${APP_URL}#today`,
    }

    if (reminder === 'breakfast') {
      payload = {
        title: `Good morning${name ? `, ${name}` : ''}`,
        body: 'Breakfast can set the rhythm. Log it while it is fresh.',
        url: `${APP_URL}#today`,
      }
    }
    if (reminder === 'lunch') {
      payload = {
        title: 'Lunch check-in',
        body: 'A photo now saves guesswork later.',
        url: `${APP_URL}#today`,
      }
    }
    if (reminder === 'dinner') {
      payload = {
        title: 'Dinner check-in',
        body: 'Take a calm moment to complete your day.',
        url: `${APP_URL}#today`,
      }
    }

    if (reminder === 'daily_report' || reminder === 'weekly_report') {
      const fromKey = reminder === 'daily_report' ? localToday : shiftKey(localToday, -6)
      const broadSince = new Date(
        now.getTime() -
          (reminder === 'daily_report' ? 36 : 9 * 24) * 60 * 60 * 1000,
      ).toISOString()
      const { data } = await supabase
        .from('meals')
        .select('eaten_at,calories_kcal,protein_g,carbs_g,fat_g')
        .eq('user_id', userId)
        .gte('eaten_at', broadSince)
      const matching = ((data ?? []) as MealRow[]).filter((meal) => {
        const key = dateKey(meal.eaten_at)
        return key >= fromKey && key <= localToday
      })
      const totals = aggregate(matching)
      if (reminder === 'daily_report') {
        payload = {
          title: 'Your day at a glance',
          body: matching.length
            ? `${Math.round(totals.calories)} kcal · ${
              Math.round(totals.protein)
            }g protein across ${matching.length} meals.`
            : 'No meals logged yet. You can still add today in under a minute.',
          url: `${APP_URL}#today`,
        }
      } else {
        const dailyAverage = Math.round(totals.calories / 7)
        payload = {
          title: 'Your weekly reflection is ready',
          body: matching.length
            ? `${matching.length} meals logged · ${dailyAverage} kcal daily average.`
            : 'A new week is a clean page. Start with one honest meal.',
          url: `${APP_URL}#insights`,
        }
      }
    }
    reportCache.set(userId, payload)
    return payload
  }

  let sent = 0
  let skipped = 0
  let failed = 0
  for (const subscription of subscriptions as SubscriptionRow[]) {
    if (!enabledUsers.has(subscription.user_id)) {
      skipped += 1
      continue
    }
    const { data: delivery, error: deliveryError } = await supabase
      .from('notification_deliveries')
      .insert({
        subscription_id: subscription.id,
        notification: reminder,
        scheduled_for: scheduledFor,
      })
      .select('id')
      .maybeSingle()
    if (deliveryError?.code === '23505') {
      skipped += 1
      continue
    }
    if (deliveryError || !delivery) {
      failed += 1
      continue
    }

    try {
      const payload = await payloadFor(subscription.user_id)
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          ...payload,
          tag: `nutrilens-${reminder}-${localParts(now).date}`,
        }),
        {
          TTL: 60 * 60 * 4,
          urgency: reminder.includes('report') ? 'normal' : 'low',
        },
      )
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'sent',
          attempted_at: new Date().toISOString(),
          sent_at: new Date().toISOString(),
        })
        .eq('id', delivery.id)
      sent += 1
    } catch (error) {
      const statusCode = typeof error === 'object' && error && 'statusCode' in error
        ? String(error.statusCode)
        : null
      await supabase
        .from('notification_deliveries')
        .update({
          status: 'failed',
          attempted_at: new Date().toISOString(),
          error_code: statusCode ?? 'send_error',
        })
        .eq('id', delivery.id)
      if (statusCode === '404' || statusCode === '410') {
        await supabase.from('push_subscriptions').delete().eq(
          'id',
          subscription.id,
        )
      }
      failed += 1
    }
  }

  return Response.json({
    status: 'complete',
    reminder,
    championPeriodsDeclared,
    championDeclarationError,
    sent,
    skipped,
    failed,
  })
})
