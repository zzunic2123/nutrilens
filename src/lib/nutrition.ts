import type { DaySummary, Meal, Nutrition, NutritionGoals, Recommendation } from '../types'
import { formatShortDay, recentDateKeys, toDateKey } from './date'

export const EMPTY_NUTRITION: Nutrition = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
}

export function sumNutrition(items: Nutrition[]): Nutrition {
  return items.reduce<Nutrition>(
    (total, item) => ({
      calories: total.calories + item.calories,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
      fiber: (total.fiber ?? 0) + (item.fiber ?? 0),
    }),
    { ...EMPTY_NUTRITION },
  )
}

export function mealTotals(meals: Meal[]): Nutrition {
  return sumNutrition(meals.map((meal) => meal.nutrition))
}

export function progress(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.max(0, Math.min(value / goal, 1))
}

export function percentage(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.round((value / goal) * 100)
}

export function mealsForDate(meals: Meal[], key: string, timezone: string): Meal[] {
  return meals.filter((meal) => toDateKey(meal.eatenAt, timezone) === key)
}

export function buildDaySummaries(
  meals: Meal[],
  days: number,
  timezone: string,
  endKey?: string,
): DaySummary[] {
  return recentDateKeys(days, endKey).map((key) => {
    const dayMeals = mealsForDate(meals, key, timezone)
    return {
      key,
      label: key,
      shortLabel: formatShortDay(key),
      totals: mealTotals(dayMeals),
      mealCount: dayMeals.length,
    }
  })
}

export function averageNutrition(days: DaySummary[]): Nutrition {
  if (days.length === 0) return { ...EMPTY_NUTRITION }
  const totals = sumNutrition(days.map((day) => day.totals))
  return {
    calories: Math.round(totals.calories / days.length),
    protein: Math.round(totals.protein / days.length),
    carbs: Math.round(totals.carbs / days.length),
    fat: Math.round(totals.fat / days.length),
    fiber: Math.round((totals.fiber ?? 0) / days.length),
  }
}

export function buildRecommendations(
  days: DaySummary[],
  goals: NutritionGoals,
): Recommendation[] {
  const activeDays = days.filter((day) => day.mealCount > 0)
  if (activeDays.length < 2) {
    return [
      {
        id: 'keep-logging',
        tone: 'neutral',
        title: 'Build the picture first',
        body: 'Log a few complete days and your guidance will become more useful.',
      },
    ]
  }

  const average = averageNutrition(activeDays)
  const recommendations: Recommendation[] = []

  if (average.protein < goals.protein * 0.8) {
    recommendations.push({
      id: 'protein',
      tone: 'attention',
      title: 'Add a protein anchor',
      body: `Your recent average is ${average.protein}g. Try adding eggs, yoghurt, fish, tofu or legumes to one meal.`,
    })
  } else {
    recommendations.push({
      id: 'protein-steady',
      tone: 'positive',
      title: 'Protein is looking steady',
      body: `You are averaging ${average.protein}g on logged days—close to your daily rhythm.`,
    })
  }

  if ((average.fiber ?? 0) < goals.fiber * 0.75) {
    recommendations.push({
      id: 'fiber',
      tone: 'neutral',
      title: 'Make room for more plants',
      body: 'A fruit, a handful of legumes or an extra vegetable serving can gently lift fiber.',
    })
  } else {
    recommendations.push({
      id: 'fiber-steady',
      tone: 'positive',
      title: 'Plant variety is showing up',
      body: `Your logged days average ${average.fiber ?? 0}g of fiber. Keep rotating fruit, vegetables, grains and legumes.`,
    })
  }

  if (average.calories > goals.calories * 1.12) {
    recommendations.push({
      id: 'energy',
      tone: 'attention',
      title: 'Energy has been running high',
      body: 'Check oils, sauces and liquid calories first—they are easy to underestimate.',
    })
  } else if (average.calories < goals.calories * 0.85) {
    recommendations.push({
      id: 'energy-low',
      tone: 'neutral',
      title: 'Energy looks light on logged days',
      body: 'Check whether snacks, drinks or cooking oils are being missed before treating this as a true deficit.',
    })
  } else {
    recommendations.push({
      id: 'energy-steady',
      tone: 'positive',
      title: 'Energy is close to your target',
      body: 'Your recent average sits in a steady range. Keep focusing on consistency over precision.',
    })
  }

  return recommendations.slice(0, 3)
}

export function validateNutrition(nutrition: Nutrition): string | null {
  const values = [nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat]
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return 'Nutrition values must be positive numbers.'
  }
  if (nutrition.calories > 20_000 || Math.max(nutrition.protein, nutrition.carbs, nutrition.fat) > 2_000) {
    return 'One or more values look too large. Please double-check them.'
  }
  return null
}
