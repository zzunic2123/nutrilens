import { ArrowLeft, ArrowRight, Camera, ChevronRight, Flame, Plus, Sparkles, Type, Zap } from 'lucide-preact'
import type { Meal, MealSource } from '../types'
import { CalorieDial, MacroProgress, MealCard } from '../components/NutritionUI'
import { useApp } from '../contexts/AppContext'
import { MACROS } from '../lib/constants'
import { formatDayHeading, formatLongDate, shiftDateKey, todayKey } from '../lib/date'
import { firstName, formatNumber, greeting } from '../lib/format'
import { buildDaySummaries, buildRecommendations, mealTotals, mealsForDate, percentage } from '../lib/nutrition'

interface TodayPageProps {
  selectedDate: string
  onSelectedDate: (key: string) => void
  onAdd: (mode?: MealSource) => void
  onShowInsights: () => void
}

export function TodayPage({ selectedDate, onSelectedDate, onAdd, onShowInsights }: TodayPageProps) {
  const { profile, meals, deleteMeal, notify, demoMode, dataError, refresh } = useApp()
  const today = todayKey(profile.timezone)
  const dayMeals = mealsForDate(meals, selectedDate, profile.timezone).sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
  const totals = mealTotals(dayMeals)
  const summaries = buildDaySummaries(meals, 7, profile.timezone, today)
  const recommendations = buildRecommendations(summaries, profile.goals)
  const loggedDays = summaries.filter((day) => day.mealCount > 0).length
  const caloriePercent = percentage(totals.calories, profile.goals.calories)

  const handleDelete = async (meal: Meal) => {
    if (!window.confirm(`Delete “${meal.title}”? This cannot be undone.`)) return
    try {
      await deleteMeal(meal.id)
    } catch (error) {
      notify({ tone: 'error', title: 'Could not delete meal', detail: error instanceof Error ? error.message : undefined })
    }
  }

  return (
    <div class="page today-page">
      <header class="page-heading today-heading">
        <div>
          <span class="eyebrow">{greeting()}, {firstName(profile.displayName)}</span>
          <h1>{selectedDate === today ? 'Your daily balance' : formatDayHeading(selectedDate, today)}</h1>
          <p>{formatLongDate(selectedDate)} · A clear view of what you have logged.</p>
        </div>
        <div class="heading-actions">
          {demoMode && <span class="demo-pill"><Sparkles size={13} /> Sample data</span>}
          <button class="button button--primary desktop-add" onClick={() => onAdd()}><Plus size={18} /> Log a meal</button>
        </div>
      </header>

      {dataError && (
        <div class="inline-alert inline-alert--error">
          <div><strong>We couldn’t refresh your data.</strong><span>{dataError}</span></div>
          <button class="button button--small button--secondary" onClick={() => void refresh()}>Try again</button>
        </div>
      )}

      <div class="date-switcher" aria-label="Choose day">
        <button class="icon-button icon-button--ghost" onClick={() => onSelectedDate(shiftDateKey(selectedDate, -1))} aria-label="Previous day">
          <ArrowLeft size={18} />
        </button>
        <button class="date-switcher-current" onClick={() => onSelectedDate(today)}>
          <strong>{formatDayHeading(selectedDate, today)}</strong>
          {selectedDate !== today && <small>Jump to today</small>}
        </button>
        <button
          class="icon-button icon-button--ghost"
          onClick={() => onSelectedDate(shiftDateKey(selectedDate, 1))}
          aria-label="Next day"
          disabled={selectedDate >= today}
        >
          <ArrowRight size={18} />
        </button>
      </div>

      <section class="dashboard-grid">
        <article class="card overview-card">
          <div class="card-heading-row">
            <div><span class="eyebrow">Energy</span><h2>{selectedDate === today ? 'Today at a glance' : 'Day at a glance'}</h2></div>
            <span class={`goal-status${caloriePercent > 110 ? ' goal-status--over' : ''}`}>{caloriePercent}% of goal</span>
          </div>
          <div class="overview-content">
            <CalorieDial current={totals.calories} goal={profile.goals.calories} />
            <div class="macro-list">
              {MACROS.map((macro) => (
                <MacroProgress
                  key={macro.key}
                  label={macro.label}
                  value={totals[macro.key]}
                  goal={profile.goals[macro.key]}
                  color={macro.color}
                />
              ))}
              <div class="fiber-row">
                <span>Fiber</span>
                <strong>{formatNumber(totals.fiber ?? 0)}<small> / {profile.goals.fiber}g</small></strong>
              </div>
            </div>
          </div>
          <footer class="overview-footer">
            <span><Flame size={17} /> {formatNumber(totals.calories)} kcal logged</span>
            <span><Zap size={17} /> {dayMeals.length} {dayMeals.length === 1 ? 'meal' : 'meals'}</span>
          </footer>
        </article>

        <article class="card quick-log-card">
          <div class="quick-log-copy">
            <span class="eyebrow eyebrow--light"><Sparkles size={13} /> Effortless logging</span>
            <h2>What did you eat?</h2>
            <p>Take a photo or describe it naturally. You always review the estimate before anything is saved.</p>
          </div>
          <div class="quick-log-actions">
            <button onClick={() => onAdd('photo_ai')}><span><Camera size={21} /></span><div><strong>Snap a photo</strong><small>Best for a plated meal</small></div><ChevronRight size={18} /></button>
            <button onClick={() => onAdd('text_ai')}><span><Type size={21} /></span><div><strong>Describe your meal</strong><small>“Oats with banana…”</small></div><ChevronRight size={18} /></button>
          </div>
          <button class="manual-link" onClick={() => onAdd('manual')}><Plus size={15} /> Enter nutrition manually</button>
        </article>
      </section>

      <section class="content-grid">
        <div class="meal-section">
          <div class="section-heading">
            <div><span class="eyebrow">Timeline</span><h2>{selectedDate === today ? 'Today’s meals' : 'Meals logged'}</h2></div>
            <strong>{formatNumber(totals.calories)} kcal</strong>
          </div>
          {dayMeals.length > 0 ? (
            <div class="meal-list">
              {dayMeals.map((meal) => <MealCard meal={meal} onDelete={handleDelete} key={meal.id} />)}
              <button class="add-meal-row" onClick={() => onAdd()}><span><Plus size={18} /></span><div><strong>Add another meal</strong><small>Photo, text or manual</small></div><ChevronRight size={18} /></button>
            </div>
          ) : (
            <div class="empty-meals">
              <span><Camera size={25} /></span>
              <h3>A fresh page for this day</h3>
              <p>Start with a photo, a quick description or the values you already know.</p>
              <button class="button button--primary" onClick={() => onAdd()}><Plus size={18} /> Log your first meal</button>
            </div>
          )}
        </div>

        <aside class="today-aside">
          <article class="card rhythm-card">
            <div class="rhythm-top">
              <span class="rhythm-number">{loggedDays}</span>
              <div><span class="eyebrow">This week</span><h3>{loggedDays === 7 ? 'A complete week' : 'Your rhythm is forming'}</h3></div>
            </div>
            <div class="week-dots">
              {summaries.map((day) => <span class={day.mealCount > 0 ? 'filled' : ''} key={day.key}><i />{day.shortLabel.slice(0, 1)}</span>)}
            </div>
            <button onClick={onShowInsights}>See weekly insights <ArrowRight size={16} /></button>
          </article>

          <article class="card guidance-card">
            <div class="section-heading compact"><div><span class="eyebrow">Gentle guidance</span><h3>One thing to try</h3></div><Sparkles size={18} /></div>
            <div class={`guidance-icon guidance-icon--${recommendations[0]?.tone ?? 'neutral'}`}><Sparkles size={20} /></div>
            <strong>{recommendations[0]?.title}</strong>
            <p>{recommendations[0]?.body}</p>
            <small>Based on your logged days, not medical advice.</small>
          </article>
        </aside>
      </section>
    </div>
  )
}
