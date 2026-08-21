import { CalendarDays, LoaderCircle, UtensilsCrossed } from 'lucide-preact'
import type { LeaderboardPeriod, PlayerMealTimeline } from '../types'
import { formatLongDate, formatMealTime } from '../lib/date'
import { formatNumber } from '../lib/format'
import { groupPublicMealsByDay } from '../lib/leaderboard'
import { Modal } from './Modal'
import { NutritionFacts } from './NutritionUI'

interface PlayerMealModalProps {
  player: { displayName: string; period: LeaderboardPeriod } | null
  timeline: PlayerMealTimeline | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  onLoadMore: () => void
  onClose: () => void
}

export function PlayerMealModal({
  player,
  timeline,
  loading,
  loadingMore,
  error,
  onLoadMore,
  onClose,
}: PlayerMealModalProps) {
  if (!player) return null
  const days = timeline ? groupPublicMealsByDay(timeline.meals) : []
  return (
    <Modal open title={`${player.displayName}'s meals`} eyebrow="Public meal view" onClose={onClose} wide>
      <div class="player-meal-view">
        {loading && (
          <div class="leaderboard-loading leaderboard-loading--modal">
            <LoaderCircle class="spin" size={24} /><span>Loading the winning fuel…</span>
          </div>
        )}
        {!loading && error && <div class="inline-alert inline-alert--error"><strong>Meals unavailable</strong><span>{error}</span></div>}
        {!loading && timeline && (
          <>
            <div class="player-meal-period">
              <CalendarDays size={16} />
              <span>{formatLongDate(timeline.startKey)}{timeline.endKey !== timeline.startKey ? ` – ${formatLongDate(timeline.endKey)}` : ''}</span>
              <small>{timeline.meals.length} {timeline.meals.length === 1 ? 'meal' : 'meals'}</small>
            </div>
            {days.length > 0 ? (
              <>
                {days.map((day) => (
                  <section class="player-meal-day" key={day.key}>
                    <header><span class="eyebrow">{formatLongDate(day.key)}</span><strong>{day.meals.length} {day.meals.length === 1 ? 'meal' : 'meals'}</strong></header>
                    <div>
                      {day.meals.map((meal) => (
                        <article class="public-meal-card" key={meal.id}>
                          <div class="public-meal-heading">
                            <span><UtensilsCrossed size={17} /></span>
                            <div><h3>{meal.title}</h3><small>{formatMealTime(meal.eatenAt)}</small></div>
                            <strong>{formatNumber(meal.nutrition.protein)}g protein</strong>
                          </div>
                          <NutritionFacts nutrition={meal.nutrition} />
                          {meal.items.length > 0 && (
                            <div class="public-meal-items">
                              {meal.items.map((item) => (
                                <span key={item.id}>
                                  <strong>{item.name}</strong>
                                  <small>{item.estimatedGrams == null ? item.preparation ?? 'Portion not specified' : `~${formatNumber(item.estimatedGrams)}g${item.preparation ? ` · ${item.preparation}` : ''}`}</small>
                                </span>
                              ))}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
                {timeline.hasMore && (
                  <button class="button button--secondary player-meal-more" onClick={onLoadMore} disabled={loadingMore}>
                    {loadingMore && <LoaderCircle class="spin" size={15} />}
                    Load more meals
                  </button>
                )}
              </>
            ) : (
              <div class="leaderboard-empty"><UtensilsCrossed size={25} /><h3>No meals in this period</h3><p>This Player has not logged food in the selected Competition Period.</p></div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
