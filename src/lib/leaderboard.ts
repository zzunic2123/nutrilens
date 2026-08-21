import type {
  CompetitionWindow,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardStat,
  PublicMeal,
  PublicMealDay,
} from '../types'
import { APP_TIMEZONE } from './constants'
import { shiftDateKey, toDateKey } from './date'

export const COMPETITION_PERIODS: Record<
  LeaderboardPeriod,
  { label: string; championLoggedDays: number | null }
> = {
  today: { label: 'Today', championLoggedDays: null },
  week: { label: 'Week', championLoggedDays: 4 },
  month: { label: 'Month', championLoggedDays: 15 },
}

export const COMPETITION_PERIOD_OPTIONS = (['today', 'week', 'month'] as const)
  .map((value) => ({ value, ...COMPETITION_PERIODS[value] }))

function weekStart(key: string): string {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay()
  return shiftDateKey(key, -(day === 0 ? 6 : day - 1))
}

function monthEnd(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0, 12)).toISOString().slice(0, 10)
}

export function competitionWindow(
  period: LeaderboardPeriod,
  now = new Date(),
): CompetitionWindow {
  const today = toDateKey(now, APP_TIMEZONE)
  if (period === 'today') return { period, startKey: today, endKey: today }
  if (period === 'week') {
    const startKey = weekStart(today)
    return { period, startKey, endKey: shiftDateKey(startKey, 6) }
  }
  return {
    period,
    startKey: `${today.slice(0, 7)}-01`,
    endKey: monthEnd(today),
  }
}

function eligibleFor(period: LeaderboardPeriod, score: number | null, loggedDays: number): boolean {
  if (score == null) return false
  const requiredDays = COMPETITION_PERIODS[period].championLoggedDays
  return requiredDays == null || loggedDays >= requiredDays
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  if (a.score == null && b.score == null) return a.displayName.localeCompare(b.displayName)
  if (a.score == null) return 1
  if (b.score == null) return -1
  return (
    b.score - a.score ||
    b.protein - a.protein ||
    b.loggedDays - a.loggedDays ||
    a.calories - b.calories ||
    a.displayName.localeCompare(b.displayName)
  )
}

function competitivelyEqual(a: LeaderboardEntry, b: LeaderboardEntry): boolean {
  return a.score === b.score &&
    a.protein === b.protein &&
    a.loggedDays === b.loggedDays &&
    a.calories === b.calories
}

export function rankLeaderboard(
  stats: LeaderboardStat[],
  period: LeaderboardPeriod,
): LeaderboardEntry[] {
  const ranked = stats.map<LeaderboardEntry>((entry) => {
    const score = entry.calories > 0 ? entry.protein / entry.calories * 1_000 : null
    return { ...entry, rank: 0, score, eligible: eligibleFor(period, score, entry.loggedDays) }
  }).sort(compareEntries)

  const output: LeaderboardEntry[] = []
  for (const [index, entry] of ranked.entries()) {
    output.push({
      ...entry,
      rank: index > 0 && competitivelyEqual(entry, ranked[index - 1])
        ? output[index - 1].rank
        : index + 1,
    })
  }
  return output
}

export function groupPublicMealsByDay(meals: PublicMeal[]): PublicMealDay[] {
  const groups = new Map<string, PublicMeal[]>()
  for (const meal of [...meals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))) {
    const key = toDateKey(meal.eatenAt, APP_TIMEZONE)
    groups.set(key, [...(groups.get(key) ?? []), meal])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, groupedMeals]) => ({ key, meals: groupedMeals }))
}
