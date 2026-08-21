import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LeaderboardOverview, PlayerMealTimeline } from '../types'
import { LeaderboardPage } from './LeaderboardPage'

const overview: LeaderboardOverview = {
  period: 'week',
  startKey: '2026-08-17',
  endKey: '2026-08-23',
  entries: [
    {
      userId: 'matija', displayName: 'Matija', rank: 1, score: 100, protein: 90, calories: 900,
      loggedDays: 3, mealCount: 3, eligible: false, isCurrentUser: false,
    },
    {
      userId: 'alex', displayName: 'Alex', rank: 2, score: 80, protein: 160, calories: 2_000,
      loggedDays: 4, mealCount: 8, eligible: true, isCurrentUser: true,
    },
  ],
  latestWeekChampions: [{
    id: 'week-alex', period: 'week', startKey: '2026-08-10', endKey: '2026-08-16',
    userId: 'alex', displayName: 'Alex', score: 80, protein: 160, calories: 2_000,
    loggedDays: 4, declaredAt: '2026-08-17T00:05:00.000Z',
  }],
  latestMonthChampions: [{
    id: 'month-matija', period: 'month', startKey: '2026-07-01', endKey: '2026-07-31',
    userId: 'matija', displayName: 'Matija', score: 92, protein: 1_800, calories: 19_565,
    loggedDays: 27, declaredAt: '2026-08-01T00:05:00.000Z',
  }],
  championHistory: [],
  historyHasMore: false,
}

const timeline: PlayerMealTimeline = {
  userId: 'matija',
  displayName: 'Matija',
  period: 'week',
  startKey: '2026-08-17',
  endKey: '2026-08-23',
  meals: [{
    id: 'meal-1', userId: 'matija', eatenAt: '2026-08-20T12:00:00.000Z', title: 'Chicken bowl',
    nutrition: { calories: 500, protein: 45, carbs: 48, fat: 15, fiber: 7 },
    items: [{ id: 'item-1', name: 'Chicken', estimatedGrams: 180, preparation: 'Grilled' }],
  }],
  hasMore: false,
  nextCursor: null,
}

const mocks = vi.hoisted(() => ({
  loadLeaderboard: vi.fn(),
  loadLeaderboardPlayerMeals: vi.fn(),
  notify: vi.fn(),
}))

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    loadLeaderboard: mocks.loadLeaderboard,
    loadLeaderboardPlayerMeals: mocks.loadLeaderboardPlayerMeals,
    notify: mocks.notify,
  }),
}))

describe('LeaderboardPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    mocks.loadLeaderboard.mockReset().mockImplementation(async (period) => ({ ...overview, period }))
    mocks.loadLeaderboardPlayerMeals.mockReset().mockResolvedValue(timeline)
    mocks.notify.mockReset()
  })

  it('celebrates only first place and marks incomplete participation as provisional', async () => {
    render(<LeaderboardPage />)

    const first = await screen.findByRole('button', { name: "Open Matija's meals" })
    const second = screen.getByRole('button', { name: "Open Alex's meals" })
    expect(first).toHaveClass('leaderboard-row--first')
    expect(second).not.toHaveClass('leaderboard-row--first')
    expect(screen.getByText('3 of 4 days · provisional')).toBeInTheDocument()
  })

  it('loads a newly selected Competition Period', async () => {
    render(<LeaderboardPage />)
    await screen.findByRole('button', { name: "Open Matija's meals" })

    fireEvent.click(screen.getByRole('button', { name: 'Month' }))

    await waitFor(() => expect(mocks.loadLeaderboard).toHaveBeenLastCalledWith('month'))
  })

  it('opens a period-scoped Public Meal View for a selected Player', async () => {
    render(<LeaderboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: "Open Matija's meals" }))

    await waitFor(() => expect(mocks.loadLeaderboardPlayerMeals).toHaveBeenCalledWith('matija', 'week', null, null))
    expect(await screen.findByRole('heading', { name: "Matija's meals" })).toBeInTheDocument()
    expect(screen.getByText('Chicken bowl')).toBeInTheDocument()
    expect(screen.getByText('Chicken')).toBeInTheDocument()
  })

  it('ignores a stale Player response after another Player is opened', async () => {
    let resolveMatija!: (value: PlayerMealTimeline) => void
    const delayedMatija = new Promise<PlayerMealTimeline>((resolve) => { resolveMatija = resolve })
    mocks.loadLeaderboardPlayerMeals.mockImplementation((userId) => userId === 'matija'
      ? delayedMatija
      : Promise.resolve({
        ...timeline,
        userId: 'alex',
        displayName: 'Alex',
        meals: [{ ...timeline.meals[0], id: 'alex-meal', userId: 'alex', title: 'Egg breakfast' }],
      }))
    render(<LeaderboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: "Open Matija's meals" }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: "Open Alex's meals" }))
    expect(await screen.findByText('Egg breakfast')).toBeInTheDocument()

    await act(async () => resolveMatija(timeline))

    expect(screen.queryByText('Chicken bowl')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "Alex's meals" })).toBeInTheDocument()
  })

  it('loads additional meals through the bounded Public Meal View', async () => {
    mocks.loadLeaderboardPlayerMeals
      .mockResolvedValueOnce({
        ...timeline,
        hasMore: true,
        nextCursor: { eatenAt: timeline.meals[0].eatenAt, id: timeline.meals[0].id },
      })
      .mockResolvedValueOnce({
        ...timeline,
        meals: [{ ...timeline.meals[0], id: 'meal-2', title: 'Evening skyr' }],
        hasMore: false,
        nextCursor: null,
      })
    render(<LeaderboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: "Open Matija's meals" }))
    fireEvent.click(await screen.findByRole('button', { name: 'Load more meals' }))

    await waitFor(() => expect(mocks.loadLeaderboardPlayerMeals)
      .toHaveBeenLastCalledWith('matija', 'week', null, {
        eatenAt: timeline.meals[0].eatenAt,
        id: timeline.meals[0].id,
      }))
    expect(await screen.findByText('Evening skyr')).toBeInTheDocument()
  })

  it('loads older Champion History without replacing the live table', async () => {
    const currentChampion = overview.latestWeekChampions[0]
    const olderChampion = {
      ...currentChampion,
      id: 'older-filip',
      userId: 'filip',
      displayName: 'Filip',
      startKey: '2026-08-03',
      endKey: '2026-08-09',
    }
    mocks.loadLeaderboard
      .mockResolvedValueOnce({
        ...overview,
        championHistory: [currentChampion],
        historyHasMore: true,
      })
      .mockResolvedValueOnce({
        ...overview,
        championHistory: [olderChampion],
        historyHasMore: false,
      })
    render(<LeaderboardPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Load older Champions' }))

    await waitFor(() => expect(mocks.loadLeaderboard).toHaveBeenLastCalledWith('week', 1))
    expect(await screen.findByText('Filip')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: "Open Matija's meals" })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load older Champions' })).not.toBeInTheDocument()
  })
})
