import type { NutritionGoals } from '../types'

export const APP_NAME = 'NutriLens'
export const APP_TIMEZONE = 'Europe/Zagreb'

export const DEFAULT_GOALS: NutritionGoals = {
  calories: 2200,
  protein: 140,
  carbs: 245,
  fat: 70,
  fiber: 30,
}

export const MACROS = [
  { key: 'protein', label: 'Protein', unit: 'g', color: 'var(--macro-protein)' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: 'var(--macro-carbs)' },
  { key: 'fat', label: 'Fat', unit: 'g', color: 'var(--macro-fat)' },
] as const

export const REMINDER_SCHEDULE = [
  { type: 'breakfast', label: 'Breakfast check-in', time: '09:00' },
  { type: 'lunch', label: 'Lunch check-in', time: '13:00' },
  { type: 'dinner', label: 'Dinner check-in', time: '19:00' },
  { type: 'daily_report', label: 'Daily reflection', time: '21:00' },
] as const

export const APP_STORAGE_KEYS = {
  demoMode: 'nutrilens:demo-mode',
  demoMeals: 'nutrilens:demo-meals',
  demoProfile: 'nutrilens:demo-profile',
  theme: 'nutrilens:theme',
} as const
