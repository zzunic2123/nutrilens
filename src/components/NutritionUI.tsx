import { Camera, Heart, Sparkles, Trash2, UtensilsCrossed } from 'lucide-preact'
import type { Confidence, Meal, Nutrition } from '../types'
import { formatMealTime } from '../lib/date'
import { formatNumber } from '../lib/format'
import { progress } from '../lib/nutrition'
import { isAiMealSource } from '../lib/meals'

interface CalorieDialProps {
  current: number
  goal: number
  size?: number
}

export function CalorieDial({ current, goal, size = 228 }: CalorieDialProps) {
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const value = progress(current, goal)
  const remaining = Math.max(goal - current, 0)
  return (
    <div class="calorie-dial" style={{ '--dial-size': `${size}px` }}>
      <svg viewBox="0 0 220 220" role="img" aria-label={`${formatNumber(current)} of ${formatNumber(goal)} calories`}>
        <circle class="dial-track" cx="110" cy="110" r={radius} />
        <circle
          class="dial-progress"
          cx="110"
          cy="110"
          r={radius}
          stroke-dasharray={circumference}
          stroke-dashoffset={circumference * (1 - value)}
        />
      </svg>
      <div class="dial-content">
        <span>{remaining > 0 ? 'Remaining' : 'Above target'}</span>
        <strong>{formatNumber(remaining > 0 ? remaining : current - goal)}</strong>
        <small>kcal</small>
      </div>
    </div>
  )
}

interface MacroProgressProps {
  label: string
  value: number
  goal: number
  color: string
}

export function MacroProgress({ label, value, goal, color }: MacroProgressProps) {
  return (
    <div class="macro-progress">
      <div class="macro-progress-top">
        <span>{label}</span>
        <strong>{formatNumber(value)}<small> / {formatNumber(goal)}g</small></strong>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label={`${label}: ${formatNumber(value)} of ${formatNumber(goal)} grams`}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(value, goal)}
      >
        <span style={{ width: `${progress(value, goal) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  return <span class={`confidence confidence--${confidence}`}>{confidence} confidence</span>
}

export function MealCard({ meal, onDelete, onOpen }: { meal: Meal; onDelete: (meal: Meal) => void; onOpen: (meal: Meal) => void }) {
  const isAi = isAiMealSource(meal.source)
  return (
    <article class="meal-card">
      <button class="meal-card-open" onClick={() => onOpen(meal)} aria-label={`Open ${meal.title}`}>
        <div class={`meal-icon meal-icon--${meal.source}`}>
          {meal.source === 'photo_ai' ? <Camera size={20} /> : isAi ? <Sparkles size={19} /> : meal.source === 'favorite' ? <Heart size={19} /> : <UtensilsCrossed size={19} />}
        </div>
        <div class="meal-card-copy">
          <div class="meal-title-line">
            <h3>{meal.title}</h3>
            {meal.isFavorite && <Heart class="meal-favourite-mark" size={13} fill="currentColor" aria-label="Favourite meal" />}
            <span>{formatMealTime(meal.eatenAt)}</span>
          </div>
          {meal.notes && <p>{meal.notes}</p>}
          <div class="meal-macros">
            <strong>{formatNumber(meal.nutrition.calories)} kcal</strong>
            <span>{formatNumber(meal.nutrition.protein)}g P</span>
            <span>{formatNumber(meal.nutrition.carbs)}g C</span>
            <span>{formatNumber(meal.nutrition.fat)}g F</span>
            {isAi && <span class="ai-tag"><Sparkles size={12} /> AI estimate</span>}
          </div>
        </div>
      </button>
      <div class="meal-actions">
        <button class="meal-delete" onClick={() => onDelete(meal)} aria-label={`Delete ${meal.title}`}>
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}

export function NutritionFacts({ nutrition }: { nutrition: Nutrition }) {
  const items = [
    ['Calories', `${formatNumber(nutrition.calories)} kcal`],
    ['Protein', `${formatNumber(nutrition.protein)} g`],
    ['Carbs', `${formatNumber(nutrition.carbs)} g`],
    ['Fat', `${formatNumber(nutrition.fat)} g`],
    ['Fiber', nutrition.fiber == null ? '—' : `${formatNumber(nutrition.fiber)} g`],
  ]
  return (
    <dl class="nutrition-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
