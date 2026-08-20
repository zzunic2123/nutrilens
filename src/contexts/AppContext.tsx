import type { ComponentChildren } from 'preact'
import { createContext } from 'preact'
import { useCallback, useContext, useEffect, useMemo, useState } from 'preact/hooks'
import type { Session } from '@supabase/supabase-js'
import type { AnalysisInput, Meal, MealAnalysis, MealDraft, Profile, ToastMessage } from '../types'
import { APP_STORAGE_KEYS } from '../lib/constants'
import { createDemoMeals, DEMO_PROFILE, demoAnalysis } from '../lib/demo-data'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { validateNutrition } from '../lib/nutrition'
import { mealToRepeatDraft } from '../lib/meals'
import {
  analyzeMeal as analyzeMealRemote,
  createMeal,
  fetchMeals,
  fetchProfile,
  removeMeal,
  removePushSubscription,
  savePushSubscription,
  updateMealFavorite,
  updateProfile,
} from '../services/data'

interface AppContextValue {
  session: Session | null
  profile: Profile
  meals: Meal[]
  loading: boolean
  dataError: string | null
  demoMode: boolean
  configured: boolean
  toasts: ToastMessage[]
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  startDemo: () => void
  resetDemo: () => void
  refresh: () => Promise<void>
  saveMeal: (draft: MealDraft) => Promise<Meal>
  deleteMeal: (id: string) => Promise<void>
  setMealFavorite: (id: string, isFavorite: boolean) => Promise<void>
  logMealAgain: (meal: Meal) => Promise<Meal>
  saveProfile: (profile: Profile) => Promise<void>
  analyzeMeal: (input: AnalysisInput) => Promise<MealAnalysis>
  enablePush: () => Promise<void>
  disablePush: () => Promise<void>
  notify: (toast: Omit<ToastMessage, 'id'>) => void
  dismissToast: (id: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

function readStoredProfile(): Profile {
  try {
    const stored = localStorage.getItem(APP_STORAGE_KEYS.demoProfile)
    return stored ? (JSON.parse(stored) as Profile) : { ...DEMO_PROFILE, goals: { ...DEMO_PROFILE.goals } }
  } catch {
    return { ...DEMO_PROFILE, goals: { ...DEMO_PROFILE.goals } }
  }
}

function readStoredMeals(): Meal[] {
  try {
    const stored = localStorage.getItem(APP_STORAGE_KEYS.demoMeals)
    const meals = stored ? (JSON.parse(stored) as Meal[]) : createDemoMeals()
    return meals.map((meal) => ({
      ...meal,
      items: meal.items ?? [],
      isFavorite: meal.isFavorite ?? false,
    }))
  } catch {
    return createDemoMeals()
  }
}

function persistDemo(profile: Profile, meals: Meal[]) {
  localStorage.setItem(APP_STORAGE_KEYS.demoProfile, JSON.stringify(profile))
  localStorage.setItem(APP_STORAGE_KEYS.demoMeals, JSON.stringify(meals))
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index)
  return output.buffer
}

export function AppProvider({ children }: { children: ComponentChildren }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [demoMode, setDemoMode] = useState(
    !isSupabaseConfigured || localStorage.getItem(APP_STORAGE_KEYS.demoMode) === 'true',
  )
  const [profile, setProfile] = useState<Profile>(readStoredProfile)
  const [meals, setMeals] = useState<Meal[]>(readStoredMeals)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID()
      setToasts((current) => [...current.slice(-2), { ...toast, id }])
      window.setTimeout(() => dismissToast(id), 4800)
    },
    [dismissToast],
  )

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const loadData = useCallback(async () => {
    if (demoMode) {
      setProfile(readStoredProfile())
      setMeals(readStoredMeals())
      setDataError(null)
      setLoading(false)
      return
    }
    if (!session?.user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setDataError(null)
    setMeals([])
    try {
      const [nextProfile, nextMeals] = await Promise.all([fetchProfile(session.user), fetchMeals()])
      setProfile(nextProfile)
      setMeals(nextMeals)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load your nutrition data.'
      setDataError(message)
    } finally {
      setLoading(false)
    }
  }, [demoMode, session])

  useEffect(() => {
    if (authReady) void loadData()
  }, [authReady, loadData])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Add Supabase environment variables before signing in.')
    const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).href
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (demoMode) {
      localStorage.setItem(APP_STORAGE_KEYS.demoMode, 'false')
      setDemoMode(false)
    }
    if (supabase && session) await supabase.auth.signOut()
  }, [demoMode, session])

  const startDemo = useCallback(() => {
    localStorage.setItem(APP_STORAGE_KEYS.demoMode, 'true')
    setDemoMode(true)
    setProfile(readStoredProfile())
    setMeals(readStoredMeals())
    setLoading(false)
  }, [])

  const resetDemo = useCallback(() => {
    const nextProfile = { ...DEMO_PROFILE, goals: { ...DEMO_PROFILE.goals } }
    const nextMeals = createDemoMeals()
    persistDemo(nextProfile, nextMeals)
    setProfile(nextProfile)
    setMeals(nextMeals)
    notify({ tone: 'success', title: 'Demo data reset', detail: 'Your sample week is fresh again.' })
  }, [notify])

  const saveMeal = useCallback(
    async (draft: MealDraft) => {
      const validationError = validateNutrition(draft.nutrition)
      if (!draft.title.trim()) throw new Error('Give this meal a short name.')
      if (validationError) throw new Error(validationError)

      if (demoMode) {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()
        const meal: Meal = {
          ...draft,
          id,
          userId: profile.id,
          items: draft.items.map((item, position) => ({
            ...item,
            id: crypto.randomUUID(),
            mealId: id,
            position,
            createdAt: now,
          })),
          createdAt: now,
          updatedAt: now,
        }
        setMeals((current) => {
          const next = [meal, ...current].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
          persistDemo(profile, next)
          return next
        })
        return meal
      }

      if (!session?.user) throw new Error('Please sign in before saving a meal.')
      const meal = await createMeal(session.user.id, draft)
      setMeals((current) => [meal, ...current].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt)))
      return meal
    },
    [demoMode, profile, session],
  )

  const deleteMeal = useCallback(
    async (id: string) => {
      if (!demoMode) await removeMeal(id)
      setMeals((current) => {
        const next = current.filter((meal) => meal.id !== id)
        if (demoMode) persistDemo(profile, next)
        return next
      })
      notify({ tone: 'success', title: 'Meal removed' })
    },
    [demoMode, notify, profile],
  )

  const setMealFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      if (demoMode) {
        setMeals((current) => {
          const next = current.map((meal) => meal.id === id
            ? { ...meal, isFavorite, updatedAt: new Date().toISOString() }
            : meal)
          persistDemo(profile, next)
          return next
        })
      } else {
        const saved = await updateMealFavorite(id, isFavorite)
        setMeals((current) => current.map((meal) => meal.id === id ? saved : meal))
      }
      notify({
        tone: 'success',
        title: isFavorite ? 'Saved to favourites' : 'Removed from favourites',
        detail: isFavorite ? 'You can now log this meal again with one tap.' : undefined,
      })
    },
    [demoMode, notify, profile],
  )

  const logMealAgain = useCallback(
    async (meal: Meal) => {
      const saved = await saveMeal(mealToRepeatDraft(meal))
      notify({ tone: 'success', title: 'Meal logged again', detail: `${meal.title} was added for right now.` })
      return saved
    },
    [notify, saveMeal],
  )

  const saveProfileValue = useCallback(
    async (nextProfile: Profile) => {
      const previousProfile = profile
      const normalized = {
        ...nextProfile,
        displayName: nextProfile.displayName.trim(),
        goals: { ...nextProfile.goals },
      }
      setProfile(normalized)
      try {
        let saved = normalized
        if (!demoMode) {
          if (!session?.user) throw new Error('Please sign in before updating your profile.')
          saved = await updateProfile(session.user, normalized)
        }
        setProfile(saved)
        if (demoMode) persistDemo(saved, meals)
        notify({ tone: 'success', title: 'Settings saved', detail: 'Your targets are up to date.' })
      } catch (error) {
        setProfile(previousProfile)
        throw error
      }
    },
    [demoMode, meals, notify, profile, session],
  )

  const analyzeMealValue = useCallback(
    async (input: AnalysisInput) => {
      if (!demoMode) return analyzeMealRemote(input)
      await new Promise((resolve) => window.setTimeout(resolve, 1400))
      return demoAnalysis(input.mode === 'text' ? input.text : input.text)
    },
    [demoMode],
  )

  const enablePush = useCallback(async () => {
    if (demoMode) {
      const next = { ...profile, pushEnabled: true }
      setProfile(next)
      persistDemo(next, meals)
      notify({ tone: 'success', title: 'Reminders enabled in demo', detail: 'Connect Supabase for real push delivery.' })
      return
    }
    if (!session?.user) throw new Error('Please sign in first.')
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications are not supported by this browser.')
    }
    const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
    if (!publicKey) throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.')
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') throw new Error('Notification permission was not granted.')
    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(publicKey),
      }))
    await savePushSubscription(session.user.id, subscription)
    await saveProfileValue({ ...profile, pushEnabled: true })
  }, [demoMode, meals, notify, profile, saveProfileValue, session])

  const disablePush = useCallback(async () => {
    if (!demoMode && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await removePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
    }
    await saveProfileValue({ ...profile, pushEnabled: false })
  }, [demoMode, profile, saveProfileValue])

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      profile,
      meals,
      loading: loading || !authReady,
      dataError,
      demoMode,
      configured: isSupabaseConfigured,
      toasts,
      signInWithGoogle,
      signOut,
      startDemo,
      resetDemo,
      refresh: loadData,
      saveMeal,
      deleteMeal,
      setMealFavorite,
      logMealAgain,
      saveProfile: saveProfileValue,
      analyzeMeal: analyzeMealValue,
      enablePush,
      disablePush,
      notify,
      dismissToast,
    }),
    [
      session, profile, meals, loading, authReady, dataError, demoMode, toasts, signInWithGoogle,
      signOut, startDemo, resetDemo, loadData, saveMeal, deleteMeal, setMealFavorite,
      logMealAgain, saveProfileValue,
      analyzeMealValue, enablePush, disablePush, notify, dismissToast,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used inside AppProvider.')
  return context
}
