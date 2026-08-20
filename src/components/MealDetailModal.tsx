import { CalendarClock, Heart, LoaderCircle, Plus, Sparkles, Trash2, UtensilsCrossed } from 'lucide-preact'
import { useState } from 'preact/hooks'
import type { Meal } from '../types'
import { useApp } from '../contexts/AppContext'
import { formatLongDate, formatMealTime, toDateKey } from '../lib/date'
import { isAiMealSource } from '../lib/meals'
import { ConfidenceBadge, NutritionFacts } from './NutritionUI'
import { Modal } from './Modal'

interface MealDetailModalProps {
  meal: Meal | null
  onClose: () => void
}

export function MealDetailModal({ meal, onClose }: MealDetailModalProps) {
  const { profile, setMealFavorite, logMealAgain, deleteMeal, notify } = useApp()
  const [action, setAction] = useState<'favorite' | 'log' | 'delete' | null>(null)

  if (!meal) return null

  const toggleFavorite = async () => {
    setAction('favorite')
    try {
      await setMealFavorite(meal.id, !meal.isFavorite)
    } catch (error) {
      notify({ tone: 'error', title: 'Could not update favourite', detail: error instanceof Error ? error.message : undefined })
    } finally {
      setAction(null)
    }
  }

  const logAgain = async () => {
    setAction('log')
    try {
      await logMealAgain(meal)
      onClose()
    } catch (error) {
      notify({ tone: 'error', title: 'Could not log meal', detail: error instanceof Error ? error.message : undefined })
    } finally {
      setAction(null)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete “${meal.title}”? This cannot be undone.`)) return
    setAction('delete')
    try {
      await deleteMeal(meal.id)
      onClose()
    } catch (error) {
      notify({ tone: 'error', title: 'Could not delete meal', detail: error instanceof Error ? error.message : undefined })
    } finally {
      setAction(null)
    }
  }

  const dateKey = toDateKey(meal.eatenAt, profile.timezone)

  return (
    <Modal open title={meal.title} eyebrow="Meal details" onClose={onClose} wide>
      <div class="meal-detail-layout">
        <main class="meal-detail-main">
          <div class="meal-detail-meta">
            <span><CalendarClock size={16} /> {formatLongDate(dateKey)} at {formatMealTime(meal.eatenAt, profile.timezone)}</span>
            {meal.confidence && <ConfidenceBadge confidence={meal.confidence} />}
            {isAiMealSource(meal.source) && <span class="ai-tag"><Sparkles size={12} /> AI estimate</span>}
          </div>
          {meal.notes && <p class="meal-detail-notes">{meal.notes}</p>}
          <section class="meal-detail-section">
            <span class="eyebrow">Nutrition</span>
            <NutritionFacts nutrition={meal.nutrition} />
          </section>
          <section class="meal-detail-section">
            <div class="meal-detail-section-heading">
              <div><span class="eyebrow">Meal components</span><h3>What this meal contains</h3></div>
              <span>{meal.items.length} {meal.items.length === 1 ? 'item' : 'items'}</span>
            </div>
            {meal.items.length > 0 ? (
              <div class="meal-item-list">
                {meal.items.map((item) => (
                  <div key={item.id}>
                    <span><UtensilsCrossed size={15} /></span>
                    <p><strong>{item.name}</strong><small>{item.preparation ?? 'Preparation not specified'}</small></p>
                    <em>{item.estimatedGrams == null ? 'portion not specified' : `~${item.estimatedGrams}g`}</em>
                  </div>
                ))}
              </div>
            ) : (
              <p class="meal-items-empty">No separate components were saved for this meal.</p>
            )}
          </section>
        </main>

        <aside class="meal-detail-actions">
          <div class={`favourite-panel${meal.isFavorite ? ' favourite-panel--active' : ''}`}>
            <span><Heart size={21} fill={meal.isFavorite ? 'currentColor' : 'none'} /></span>
            <h3>{meal.isFavorite ? 'Saved as a favourite' : 'Eat this often?'}</h3>
            <p>Favourite meals stay available for quick one-tap logging.</p>
            <button class="button button--secondary button--full" onClick={() => void toggleFavorite()} disabled={action !== null}>
              {action === 'favorite' ? <LoaderCircle class="spin" size={17} /> : <Heart size={17} fill={meal.isFavorite ? 'currentColor' : 'none'} />}
              {meal.isFavorite ? 'Remove favourite' : 'Save as favourite'}
            </button>
          </div>
          <button class="button button--primary button--full button--large" onClick={() => void logAgain()} disabled={action !== null}>
            {action === 'log' ? <LoaderCircle class="spin" size={18} /> : <Plus size={18} />}
            {action === 'log' ? 'Adding…' : 'Log this meal again'}
          </button>
          <button class="meal-detail-delete" onClick={() => void remove()} disabled={action !== null}>
            {action === 'delete' ? <LoaderCircle class="spin" size={16} /> : <Trash2 size={16} />} Delete this meal
          </button>
        </aside>
      </div>
    </Modal>
  )
}
