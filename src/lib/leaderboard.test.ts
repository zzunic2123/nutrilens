import { describe, expect, it } from 'vitest'
import type { LeaderboardStat, PublicMeal } from '../types'
import {
  competitionWindow,
  groupPublicMealsByDay,
  rankLeaderboard,
} from './leaderboard'

const stats: LeaderboardStat[] = [
  { userId: 'alex', displayName: 'Alex', protein: 150, calories: 2_000, loggedDays: 4, mealCount: 10 },
  { userId: 'matija', displayName: 'Matija', protein: 120, calories: 1_500, loggedDays: 3, mealCount: 8 },
  { userId: 'filip', displayName: 'Filip', protein: 0, calories: 0, loggedDays: 0, mealCount: 0 },
]

describe('competitionWindow', () => {
  const now = new Date('2026-08-21T12:00:00.000Z')

  it('uses the shared Zagreb calendar for today', () => {
    expect(competitionWindow('today', now)).toMatchObject({
      startKey: '2026-08-21',
      endKey: '2026-08-21',
    })
  })

  it('uses a Monday-to-Sunday week', () => {
    expect(competitionWindow('week', now)).toMatchObject({
      startKey: '2026-08-17',
      endKey: '2026-08-23',
    })
  })

  it('uses a calendar month', () => {
    expect(competitionWindow('month', now)).toMatchObject({
      startKey: '2026-08-01',
      endKey: '2026-08-31',
    })
  })
})

describe('rankLeaderboard', () => {
  it('ranks by protein per 1,000 calories and keeps ineligible weekly Players provisional', () => {
    const ranked = rankLeaderboard(stats, 'week')

    expect(ranked.map((entry) => ({
      userId: entry.userId,
      rank: entry.rank,
      score: entry.score,
      eligible: entry.eligible,
    }))).toEqual([
      { userId: 'matija', rank: 1, score: 80, eligible: false },
      { userId: 'alex', rank: 2, score: 75, eligible: true },
      { userId: 'filip', rank: 3, score: null, eligible: false },
    ])
  })

  it('uses protein, logged days and lower calories as transparent tie-breakers', () => {
    const ranked = rankLeaderboard([
      { userId: 'a', displayName: 'A', protein: 100, calories: 1_000, loggedDays: 5, mealCount: 5 },
      { userId: 'b', displayName: 'B', protein: 120, calories: 1_200, loggedDays: 4, mealCount: 5 },
      { userId: 'c', displayName: 'C', protein: 120, calories: 1_200, loggedDays: 6, mealCount: 5 },
    ], 'week')

    expect(ranked.map((entry) => entry.userId)).toEqual(['c', 'b', 'a'])
  })

  it('assigns a shared first rank when every competitive value is equal', () => {
    const ranked = rankLeaderboard([
      { userId: 'b', displayName: 'Berta', protein: 120, calories: 1_500, loggedDays: 5, mealCount: 7 },
      { userId: 'a', displayName: 'Ana', protein: 120, calories: 1_500, loggedDays: 5, mealCount: 7 },
      { userId: 'c', displayName: 'Cora', protein: 80, calories: 1_500, loggedDays: 5, mealCount: 7 },
    ], 'week')

    expect(ranked.map((entry) => [entry.displayName, entry.rank])).toEqual([
      ['Ana', 1],
      ['Berta', 1],
      ['Cora', 3],
    ])
  })

  it('requires fifteen logged days for a monthly Champion', () => {
    const [entry] = rankLeaderboard([
      { userId: 'a', displayName: 'A', protein: 900, calories: 12_000, loggedDays: 14, mealCount: 30 },
    ], 'month')

    expect(entry.eligible).toBe(false)
  })
})

describe('groupPublicMealsByDay', () => {
  it('groups and sorts a Player meal timeline by Zagreb day and time', () => {
    const meals: PublicMeal[] = [
      {
        id: 'late', userId: 'player', eatenAt: '2026-08-20T22:30:00.000Z', title: 'Late bowl',
        nutrition: { calories: 500, protein: 40, carbs: 50, fat: 15, fiber: 7 }, items: [],
      },
      {
        id: 'early', userId: 'player', eatenAt: '2026-08-21T07:00:00.000Z', title: 'Breakfast',
        nutrition: { calories: 350, protein: 30, carbs: 35, fat: 10, fiber: 5 }, items: [],
      },
    ]

    expect(groupPublicMealsByDay(meals)).toEqual([
      { key: '2026-08-21', meals: [meals[1], meals[0]] },
    ])
  })
})
