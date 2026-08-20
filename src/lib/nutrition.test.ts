import { describe, expect, it } from 'vitest'
import type { DaySummary, Meal } from '../types'
import { DEFAULT_GOALS } from './constants'
import { buildRecommendations, mealTotals, percentage, validateNutrition } from './nutrition'

const meal = (calories: number, protein: number): Meal => ({
  id: crypto.randomUUID(),
  userId: 'user-1',
  eatenAt: '2026-08-10T12:00:00Z',
  title: 'Test meal',
  notes: null,
  source: 'manual',
  nutrition: { calories, protein, carbs: 50, fat: 20, fiber: 5 },
  confidence: null,
  items: [],
  isFavorite: false,
  createdAt: '2026-08-10T12:00:00Z',
  updatedAt: '2026-08-10T12:00:00Z',
})

describe('nutrition helpers', () => {
  it('aggregates all meal totals', () => {
    expect(mealTotals([meal(500, 30), meal(700, 45)])).toEqual({
      calories: 1200,
      protein: 75,
      carbs: 100,
      fat: 40,
      fiber: 10,
    })
  })

  it('calculates uncapped display percentages', () => {
    expect(percentage(110, 100)).toBe(110)
    expect(percentage(50, 0)).toBe(0)
  })

  it('rejects negative and implausibly large nutrition', () => {
    expect(validateNutrition({ calories: -1, protein: 2, carbs: 3, fat: 4, fiber: null })).toMatch(/positive/)
    expect(validateNutrition({ calories: 21_000, protein: 2, carbs: 3, fat: 4, fiber: null })).toMatch(/too large/)
    expect(validateNutrition({ calories: 700, protein: 45, carbs: 70, fat: 24, fiber: 9 })).toBeNull()
  })

  it('creates deterministic guidance from multiple logged days', () => {
    const days: DaySummary[] = [
      { key: '2026-08-09', label: 'a', shortLabel: 'Sun', mealCount: 3, totals: { calories: 1800, protein: 80, carbs: 200, fat: 65, fiber: 14 } },
      { key: '2026-08-10', label: 'b', shortLabel: 'Mon', mealCount: 3, totals: { calories: 1900, protein: 90, carbs: 210, fat: 62, fiber: 16 } },
    ]
    const recommendations = buildRecommendations(days, DEFAULT_GOALS)
    expect(recommendations.map((item) => item.id)).toContain('protein')
    expect(recommendations.map((item) => item.id)).toContain('fiber')
  })
})
