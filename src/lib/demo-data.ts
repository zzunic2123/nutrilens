import type {
  ChampionRecord,
  CompetitionWindow,
  LeaderboardOverview,
  LeaderboardPeriod,
  LeaderboardStat,
  Meal,
  MealAnalysis,
  PlayerMealTimeline,
  Profile,
  PublicMeal,
} from '../types'
import { APP_TIMEZONE, DEFAULT_GOALS } from './constants'
import { recentDateKeys, shiftDateKey, todayKey, toDateKey } from './date'
import { competitionWindow, rankLeaderboard } from './leaderboard'

function at(key: string, hour: number, minute = 0): string {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

export const DEMO_PROFILE: Profile = {
  id: 'demo-user',
  email: 'alex@example.com',
  displayName: 'Alex Morgan',
  goals: { ...DEFAULT_GOALS },
  timezone: APP_TIMEZONE,
  pushEnabled: false,
}

type DemoMeal = Omit<Meal, 'id' | 'userId' | 'items' | 'isFavorite' | 'createdAt' | 'updatedAt'>

const dayTemplates: DemoMeal[][] = [
  [
    {
      eatenAt: '', title: 'Greek yoghurt & berries', notes: 'With walnuts and honey', source: 'manual',
      nutrition: { calories: 385, protein: 25, carbs: 39, fat: 16, fiber: 6 }, confidence: null,
    },
    {
      eatenAt: '', title: 'Chicken grain bowl', notes: 'Brown rice, greens and tahini', source: 'photo_ai',
      nutrition: { calories: 710, protein: 56, carbs: 74, fat: 23, fiber: 11 }, confidence: 'medium',
    },
    {
      eatenAt: '', title: 'Salmon & roasted vegetables', notes: null, source: 'text_ai',
      nutrition: { calories: 620, protein: 48, carbs: 42, fat: 28, fiber: 9 }, confidence: 'high',
    },
  ],
  [
    {
      eatenAt: '', title: 'Eggs on sourdough', notes: 'Two eggs, avocado, chilli flakes', source: 'manual',
      nutrition: { calories: 510, protein: 24, carbs: 44, fat: 28, fiber: 8 }, confidence: null,
    },
    {
      eatenAt: '', title: 'Turkey pesto pasta', notes: 'Cherry tomatoes and rocket', source: 'text_ai',
      nutrition: { calories: 790, protein: 49, carbs: 91, fat: 25, fiber: 8 }, confidence: 'medium',
    },
    {
      eatenAt: '', title: 'Apple & almond butter', notes: null, source: 'manual',
      nutrition: { calories: 230, protein: 6, carbs: 29, fat: 12, fiber: 6 }, confidence: null,
    },
  ],
  [
    {
      eatenAt: '', title: 'Overnight oats', notes: 'Banana, chia and oat milk', source: 'text_ai',
      nutrition: { calories: 460, protein: 17, carbs: 72, fat: 13, fiber: 12 }, confidence: 'high',
    },
    {
      eatenAt: '', title: 'Tuna bean salad', notes: 'Lemon and olive oil dressing', source: 'photo_ai',
      nutrition: { calories: 590, protein: 52, carbs: 47, fat: 22, fiber: 14 }, confidence: 'medium',
    },
    {
      eatenAt: '', title: 'Beef stir-fry', notes: 'Rice noodles and mixed vegetables', source: 'photo_ai',
      nutrition: { calories: 760, protein: 45, carbs: 88, fat: 25, fiber: 8 }, confidence: 'medium',
    },
  ],
  [
    {
      eatenAt: '', title: 'Protein smoothie', notes: 'Berries, banana and yoghurt', source: 'manual',
      nutrition: { calories: 410, protein: 34, carbs: 55, fat: 8, fiber: 9 }, confidence: null,
    },
    {
      eatenAt: '', title: 'Falafel mezze plate', notes: 'Hummus, tabbouleh and flatbread', source: 'photo_ai',
      nutrition: { calories: 820, protein: 28, carbs: 112, fat: 30, fiber: 18 }, confidence: 'low',
    },
  ],
  [
    {
      eatenAt: '', title: 'Cottage cheese toast', notes: 'Tomato and pumpkin seeds', source: 'manual',
      nutrition: { calories: 390, protein: 31, carbs: 43, fat: 12, fiber: 6 }, confidence: null,
    },
    {
      eatenAt: '', title: 'Grilled chicken wrap', notes: 'Vegetables and yoghurt sauce', source: 'photo_ai',
      nutrition: { calories: 650, protein: 47, carbs: 68, fat: 21, fiber: 8 }, confidence: 'medium',
    },
    {
      eatenAt: '', title: 'Lentil coconut curry', notes: 'With basmati rice', source: 'text_ai',
      nutrition: { calories: 730, protein: 27, carbs: 111, fat: 22, fiber: 18 }, confidence: 'high',
    },
  ],
  [
    {
      eatenAt: '', title: 'Skyr fruit bowl', notes: 'Granola and raspberries', source: 'manual',
      nutrition: { calories: 420, protein: 29, carbs: 61, fat: 8, fiber: 8 }, confidence: null,
    },
    {
      eatenAt: '', title: 'Mediterranean chicken plate', notes: 'Potatoes and green salad', source: 'photo_ai',
      nutrition: { calories: 760, protein: 58, carbs: 69, fat: 29, fiber: 10 }, confidence: 'medium',
    },
    {
      eatenAt: '', title: 'Dark chocolate', notes: 'Two squares', source: 'manual',
      nutrition: { calories: 120, protein: 2, carbs: 10, fat: 9, fiber: 2 }, confidence: null,
    },
  ],
  [
    {
      eatenAt: '', title: 'Spinach omelette', notes: 'Three eggs and feta', source: 'manual',
      nutrition: { calories: 435, protein: 31, carbs: 8, fat: 31, fiber: 3 }, confidence: null,
    },
    {
      eatenAt: '', title: 'Herby chicken & couscous', notes: 'Roasted peppers and courgette', source: 'photo_ai',
      nutrition: { calories: 685, protein: 54, carbs: 71, fat: 21, fiber: 9 }, confidence: 'medium',
    },
    {
      eatenAt: '', title: 'Peach yoghurt', notes: null, source: 'manual',
      nutrition: { calories: 180, protein: 14, carbs: 25, fat: 3, fiber: 2 }, confidence: null,
    },
  ],
]

export function createDemoMeals(): Meal[] {
  const keys = recentDateKeys(7, todayKey())
  return dayTemplates.flatMap((template, dayIndex) =>
    template.map((meal, mealIndex) => {
      const hours = [8, 13, 19]
      const eatenAt = at(keys[dayIndex], hours[mealIndex] ?? 16, mealIndex * 7)
      const id = `demo-${dayIndex}-${mealIndex}`
      return {
        ...meal,
        id,
        userId: DEMO_PROFILE.id,
        eatenAt,
        items: [],
        isFavorite: (dayIndex === 0 && mealIndex === 0) || (dayIndex === 1 && mealIndex === 0),
        createdAt: eatenAt,
        updatedAt: eatenAt,
      }
    }),
  )
}

const DEMO_PLAYERS = [
  { userId: DEMO_PROFILE.id, displayName: DEMO_PROFILE.displayName },
  { userId: 'demo-matija', displayName: 'Matija Perić' },
  { userId: 'demo-filip', displayName: 'Filip Perusić' },
] as const

function createDemoFriendMeals(): PublicMeal[] {
  return recentDateKeys(75).flatMap((key) => [
    {
      id: `matija-${key}-1`, userId: 'demo-matija', eatenAt: at(key, 9), title: 'Skyr protein bowl',
      nutrition: { calories: 380, protein: 42, carbs: 38, fat: 8, fiber: 7 },
      items: [
        { id: `matija-${key}-skyr`, name: 'Skyr', estimatedGrams: 300, preparation: 'Chilled' },
        { id: `matija-${key}-berries`, name: 'Mixed berries', estimatedGrams: 120, preparation: 'Fresh' },
      ],
    },
    {
      id: `matija-${key}-2`, userId: 'demo-matija', eatenAt: at(key, 18, 30), title: 'Chicken & greens',
      nutrition: { calories: 620, protein: 62, carbs: 48, fat: 18, fiber: 11 },
      items: [
        { id: `matija-${key}-chicken`, name: 'Chicken breast', estimatedGrams: 210, preparation: 'Grilled' },
        { id: `matija-${key}-greens`, name: 'Seasonal vegetables', estimatedGrams: 260, preparation: 'Roasted' },
      ],
    },
    {
      id: `filip-${key}-1`, userId: 'demo-filip', eatenAt: at(key, 8, 15), title: 'Eggs & cottage cheese',
      nutrition: { calories: 450, protein: 32, carbs: 24, fat: 25, fiber: 4 },
      items: [
        { id: `filip-${key}-eggs`, name: 'Eggs', estimatedGrams: 150, preparation: 'Scrambled' },
        { id: `filip-${key}-cottage`, name: 'Cottage cheese', estimatedGrams: 140, preparation: null },
      ],
    },
    {
      id: `filip-${key}-2`, userId: 'demo-filip', eatenAt: at(key, 19), title: 'Tuna rice plate',
      nutrition: { calories: 620, protein: 55, carbs: 67, fat: 15, fiber: 8 },
      items: [
        { id: `filip-${key}-tuna`, name: 'Tuna', estimatedGrams: 180, preparation: 'Drained' },
        { id: `filip-${key}-rice`, name: 'Rice', estimatedGrams: 190, preparation: 'Boiled' },
      ],
    },
  ])
}

function ownPublicMeals(meals: Meal[]): PublicMeal[] {
  return meals.map((meal) => ({
    id: meal.id,
    userId: meal.userId,
    eatenAt: meal.eatenAt,
    title: meal.title,
    nutrition: { ...meal.nutrition },
    items: meal.items.map((item) => ({
      id: item.id,
      name: item.name,
      estimatedGrams: item.estimatedGrams,
      preparation: item.preparation,
    })),
  }))
}

function mealsInWindow(meals: PublicMeal[], window: CompetitionWindow): PublicMeal[] {
  return meals.filter((meal) => {
    const key = toDateKey(meal.eatenAt, APP_TIMEZONE)
    return key >= window.startKey && key <= window.endKey
  })
}

function statsFor(meals: PublicMeal[], window: CompetitionWindow): LeaderboardStat[] {
  return DEMO_PLAYERS.map((player) => {
    const matching = mealsInWindow(meals.filter((meal) => meal.userId === player.userId), window)
    return {
      ...player,
      protein: matching.reduce((sum, meal) => sum + meal.nutrition.protein, 0),
      calories: matching.reduce((sum, meal) => sum + meal.nutrition.calories, 0),
      loggedDays: new Set(matching.map((meal) => toDateKey(meal.eatenAt, APP_TIMEZONE))).size,
      mealCount: matching.length,
      isCurrentUser: player.userId === DEMO_PROFILE.id,
    }
  })
}

function championRecords(
  window: CompetitionWindow,
  meals: PublicMeal[],
): ChampionRecord[] {
  const period = window.period
  if (period === 'today') return []
  const eligible = rankLeaderboard(statsFor(meals, window), period).filter((entry) => entry.eligible)
  const leader = eligible[0]
  if (!leader || leader.score == null) return []
  return eligible
    .filter((entry) => entry.score === leader.score &&
      entry.protein === leader.protein &&
      entry.loggedDays === leader.loggedDays &&
      entry.calories === leader.calories)
    .map((entry) => ({
      id: `demo-${period}-${window.startKey}-${entry.userId}`,
      period,
      startKey: window.startKey,
      endKey: window.endKey,
      userId: entry.userId,
      displayName: entry.displayName,
      score: entry.score!,
      protein: entry.protein,
      calories: entry.calories,
      loggedDays: entry.loggedDays,
      declaredAt: `${shiftDateKey(window.endKey, 1)}T00:05:00.000Z`,
    }))
}

function historicalWindows(): CompetitionWindow[] {
  const currentWeek = competitionWindow('week')
  const currentMonth = competitionWindow('month')
  return [
    competitionWindow('week', new Date(`${shiftDateKey(currentWeek.startKey, -1)}T12:00:00Z`)),
    competitionWindow('month', new Date(`${shiftDateKey(currentMonth.startKey, -1)}T12:00:00Z`)),
    competitionWindow('week', new Date(`${shiftDateKey(currentWeek.startKey, -8)}T12:00:00Z`)),
    competitionWindow('month', new Date(`${shiftDateKey(currentMonth.startKey, -32)}T12:00:00Z`)),
  ]
}

export function demoLeaderboardOverview(
  period: LeaderboardPeriod,
  ownMeals: Meal[],
): LeaderboardOverview {
  const window = competitionWindow(period)
  const friendMeals = createDemoFriendMeals()
  const allMeals = [...ownPublicMeals(ownMeals), ...friendMeals]
  const history = historicalWindows()
    .flatMap((historicWindow) => championRecords(historicWindow, friendMeals))
    .sort((a, b) => b.endKey.localeCompare(a.endKey) || a.displayName.localeCompare(b.displayName))
  const latestWeekStart = history.find((champion) => champion.period === 'week')?.startKey
  const latestMonthStart = history.find((champion) => champion.period === 'month')?.startKey
  return {
    ...window,
    entries: rankLeaderboard(statsFor(allMeals, window), period),
    latestWeekChampions: history.filter((champion) => champion.period === 'week' && champion.startKey === latestWeekStart),
    latestMonthChampions: history.filter((champion) => champion.period === 'month' && champion.startKey === latestMonthStart),
    championHistory: history,
    historyHasMore: false,
  }
}

export function demoPlayerMealTimeline(
  userId: string,
  period: LeaderboardPeriod,
  periodStart: string | null,
  ownMeals: Meal[],
): PlayerMealTimeline {
  const current = competitionWindow(period)
  const window = periodStart == null
    ? current
    : period === 'today'
      ? { period, startKey: periodStart, endKey: periodStart }
      : competitionWindow(period, new Date(`${periodStart}T12:00:00Z`))
  const allMeals = [...ownPublicMeals(ownMeals), ...createDemoFriendMeals()]
  const player = DEMO_PLAYERS.find((candidate) => candidate.userId === userId)
  if (!player) throw new Error('Player is not available.')
  return {
    ...window,
    ...player,
    meals: mealsInWindow(allMeals.filter((meal) => meal.userId === userId), window),
    hasMore: false,
    nextCursor: null,
  }
}

export function demoAnalysis(inputText?: string): MealAnalysis {
  const text = inputText?.toLowerCase() ?? ''
  if (text.includes('pizza')) {
    return {
      schema_version: '1.0', status: 'estimated', title: 'Pizza & side salad',
      description: 'Two slices of pizza with a lightly dressed mixed salad.',
      detected_foods: [
        { name: 'Pizza', estimated_grams: 260, preparation: 'Baked' },
        { name: 'Mixed salad', estimated_grams: 120, preparation: 'Lightly dressed' },
      ],
      nutrition: { calories_kcal: 720, protein_g: 29, carbs_g: 83, fat_g: 31, fiber_g: 7 },
      confidence: 'medium',
      assumptions: ['Pizza slices are a standard restaurant size', 'Salad contains about one teaspoon of oil'],
      clarification_question: null,
    }
  }

  return {
    schema_version: '1.0', status: 'estimated', title: 'Grilled chicken grain bowl',
    description: 'Grilled chicken breast with rice, greens, tomato and a creamy dressing.',
    detected_foods: [
      { name: 'Grilled chicken breast', estimated_grams: 170, preparation: 'Grilled' },
      { name: 'Cooked rice', estimated_grams: 190, preparation: 'Boiled' },
      { name: 'Mixed vegetables', estimated_grams: 140, preparation: 'Fresh' },
      { name: 'Dressing', estimated_grams: 25, preparation: 'Creamy' },
    ],
    nutrition: { calories_kcal: 685, protein_g: 55, carbs_g: 69, fat_g: 21, fiber_g: 8 },
    confidence: 'medium',
    assumptions: ['Chicken is skinless', 'Approximately two tablespoons of dressing', 'No additional cooking oil is visible'],
    clarification_question: null,
  }
}
