export type AiMealSource = 'text_ai' | 'photo_ai'
export type ComposerMealSource = 'manual' | AiMealSource
export type MealSource = ComposerMealSource | 'favorite'
export type Confidence = 'low' | 'medium' | 'high'
export type AnalysisStatus = 'estimated' | 'needs_clarification' | 'not_food'
export type AppPage = 'today' | 'insights' | 'settings'

export interface Nutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
}

export interface NutritionGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface Profile {
  id: string
  email: string
  displayName: string
  goals: NutritionGoals
  timezone: string
  pushEnabled: boolean
}

export interface MealItemDraft {
  name: string
  estimatedGrams: number | null
  preparation: string | null
}

export interface MealItem extends MealItemDraft {
  id: string
  mealId: string
  position: number
  createdAt: string
}

export interface Meal {
  id: string
  userId: string
  eatenAt: string
  title: string
  notes: string | null
  source: MealSource
  nutrition: Nutrition
  confidence: Confidence | null
  items: MealItem[]
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

export interface MealDraft {
  eatenAt: string
  title: string
  notes: string | null
  source: MealSource
  nutrition: Nutrition
  confidence: Confidence | null
  items: MealItemDraft[]
  isFavorite: boolean
}

export interface DetectedFood {
  name: string
  estimated_grams: number | null
  preparation: string | null
}

export interface MealAnalysis {
  schema_version: '1.0'
  status: AnalysisStatus
  title: string
  description: string
  detected_foods: DetectedFood[]
  nutrition: {
    calories_kcal: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
    fiber_g: number | null
  }
  confidence: Confidence
  assumptions: string[]
  clarification_question: string | null
}

export type AnalysisInput =
  | { mode: 'text'; text: string; imageDataUrl?: never }
  | { mode: 'photo'; text?: string; imageDataUrl: string }

export interface DaySummary {
  key: string
  label: string
  shortLabel: string
  totals: Nutrition
  mealCount: number
}

export interface Recommendation {
  id: string
  tone: 'positive' | 'attention' | 'neutral'
  title: string
  body: string
}

export interface ToastMessage {
  id: string
  tone: 'success' | 'error' | 'info'
  title: string
  detail?: string
}
