import type { DetectedFood, Meal, MealDraft, MealItemDraft, MealSource } from '../types'

export function isAiMealSource(source: MealSource): boolean {
  return source === 'photo_ai' || source === 'text_ai'
}

export function detectedFoodsToMealItems(foods: DetectedFood[]): MealItemDraft[] {
  return foods.map((food) => ({
    name: food.name,
    estimatedGrams: food.estimated_grams,
    preparation: food.preparation,
  }))
}

export function mealToRepeatDraft(meal: Meal, eatenAt = new Date().toISOString()): MealDraft {
  return {
    eatenAt,
    title: meal.title,
    notes: meal.notes,
    source: 'favorite',
    nutrition: { ...meal.nutrition },
    confidence: null,
    items: meal.items.map((item) => ({
      name: item.name,
      estimatedGrams: item.estimatedGrams,
      preparation: item.preparation,
    })),
    isFavorite: false,
  }
}
