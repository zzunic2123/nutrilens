import { describe, expect, it } from 'vitest'
import type { Meal } from '../types'
import { detectedFoodsToMealItems, isAiMealSource, mealToRepeatDraft } from './meals'

const meal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  eatenAt: '2026-08-19T12:00:00.000Z',
  title: 'Chicken bowl',
  notes: 'With tahini',
  source: 'photo_ai',
  nutrition: { calories: 650, protein: 48, carbs: 70, fat: 20, fiber: 9 },
  confidence: 'medium',
  items: [{
    id: 'item-1',
    mealId: 'meal-1',
    position: 0,
    name: 'Chicken',
    estimatedGrams: 170,
    preparation: 'Grilled',
    createdAt: '2026-08-19T12:00:00.000Z',
  }],
  isFavorite: true,
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
}

describe('meal helpers', () => {
  it('distinguishes AI analyses from manual and favourite logging', () => {
    expect(isAiMealSource('photo_ai')).toBe(true)
    expect(isAiMealSource('text_ai')).toBe(true)
    expect(isAiMealSource('manual')).toBe(false)
    expect(isAiMealSource('favorite')).toBe(false)
  })

  it('turns detected foods into persistable meal items', () => {
    expect(detectedFoodsToMealItems([{ name: 'Rice', estimated_grams: 180, preparation: 'Boiled' }])).toEqual([
      { name: 'Rice', estimatedGrams: 180, preparation: 'Boiled' },
    ])
  })

  it('copies a favourite into a fresh occurrence without carrying favourite or AI state', () => {
    const draft = mealToRepeatDraft(meal, '2026-08-20T09:30:00.000Z')
    expect(draft).toMatchObject({
      eatenAt: '2026-08-20T09:30:00.000Z',
      source: 'favorite',
      confidence: null,
      isFavorite: false,
      items: [{ name: 'Chicken', estimatedGrams: 170, preparation: 'Grilled' }],
    })
    expect(draft.nutrition).not.toBe(meal.nutrition)
  })
})
