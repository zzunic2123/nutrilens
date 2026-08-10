import { ArrowDownRight, ArrowUpRight, CalendarRange, CheckCircle2, Leaf, Sparkles, Target, TrendingUp } from 'lucide-preact'
import { useMemo, useState } from 'preact/hooks'
import type { DaySummary } from '../types'
import { useApp } from '../contexts/AppContext'
import { todayKey } from '../lib/date'
import { formatNumber } from '../lib/format'
import { averageNutrition, buildDaySummaries, buildRecommendations, percentage } from '../lib/nutrition'

function EnergyChart({ days, goal }: { days: DaySummary[]; goal: number }) {
  const max = Math.max(goal * 1.25, ...days.map((day) => day.totals.calories), 1)
  const goalPosition = 100 - (goal / max) * 100
  return (
    <div class={`energy-chart${days.length > 10 ? ' energy-chart--dense' : ''}`}>
      <div class="chart-goal" style={{ top: `${goalPosition}%` }}><span>Goal {formatNumber(goal)}</span></div>
      <div class="chart-bars">
        {days.map((day, index) => {
          const height = day.mealCount > 0 ? Math.max(4, (day.totals.calories / max) * 100) : 1
          const isLast = index === days.length - 1
          return (
            <div class="chart-bar-column" key={day.key} title={`${day.key}: ${formatNumber(day.totals.calories)} kcal`}>
              <div class={`chart-bar${isLast ? ' chart-bar--today' : ''}${day.mealCount === 0 ? ' chart-bar--empty' : ''}`} style={{ height: `${height}%` }}>
                {days.length <= 7 && day.mealCount > 0 && <span>{formatNumber(day.totals.calories)}</span>}
              </div>
              {(days.length <= 7 || index % 5 === 0 || isLast) && <small>{days.length <= 7 ? day.shortLabel : day.key.slice(5)}</small>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function InsightsPage() {
  const { profile, meals } = useApp()
  const [range, setRange] = useState<7 | 30>(7)
  const days = useMemo(
    () => buildDaySummaries(meals, range, profile.timezone, todayKey(profile.timezone)),
    [meals, profile.timezone, range],
  )
  const loggedDays = days.filter((day) => day.mealCount > 0)
  const average = averageNutrition(loggedDays)
  const recommendations = buildRecommendations(days, profile.goals)
  const previousDays = days.slice(0, Math.floor(days.length / 2)).filter((day) => day.mealCount > 0)
  const recentDays = days.slice(Math.floor(days.length / 2)).filter((day) => day.mealCount > 0)
  const previousAverage = averageNutrition(previousDays)
  const recentAverage = averageNutrition(recentDays)
  const calorieDelta = previousAverage.calories
    ? Math.round(((recentAverage.calories - previousAverage.calories) / previousAverage.calories) * 100)
    : 0
  const adherence = loggedDays.length
    ? Math.round(
        loggedDays.reduce((sum, day) => {
          const ratio = Math.abs(day.totals.calories - profile.goals.calories) / profile.goals.calories
          return sum + Math.max(0, 1 - ratio)
        }, 0) /
          loggedDays.length *
          100,
      )
    : 0

  return (
    <div class="page insights-page">
      <header class="page-heading insights-heading">
        <div>
          <span class="eyebrow">Your patterns</span>
          <h1>Insights, without judgement</h1>
          <p>Use the trend, not one meal, to decide what feels worth changing.</p>
        </div>
        <div class="range-tabs" role="group" aria-label="Report period">
          <button class={range === 7 ? 'active' : ''} onClick={() => setRange(7)}>7 days</button>
          <button class={range === 30 ? 'active' : ''} onClick={() => setRange(30)}>30 days</button>
        </div>
      </header>

      <section class="insight-metrics">
        <article class="metric-card">
          <span class="metric-icon metric-icon--green"><Target size={19} /></span>
          <div><span>Daily average</span><strong>{formatNumber(average.calories)} <small>kcal</small></strong></div>
          <em class={Math.abs(calorieDelta) <= 5 ? 'steady' : calorieDelta > 0 ? 'up' : 'down'}>
            {calorieDelta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(calorieDelta)}%
          </em>
        </article>
        <article class="metric-card">
          <span class="metric-icon metric-icon--purple"><TrendingUp size={19} /></span>
          <div><span>Protein average</span><strong>{formatNumber(average.protein)} <small>g</small></strong></div>
          <em class={average.protein >= profile.goals.protein * 0.8 ? 'steady' : 'down'}>
            {percentage(average.protein, profile.goals.protein)}% goal
          </em>
        </article>
        <article class="metric-card">
          <span class="metric-icon metric-icon--orange"><Leaf size={19} /></span>
          <div><span>Fiber average</span><strong>{formatNumber(average.fiber ?? 0)} <small>g</small></strong></div>
          <em class={(average.fiber ?? 0) >= profile.goals.fiber * 0.8 ? 'steady' : 'down'}>
            {percentage(average.fiber ?? 0, profile.goals.fiber)}% goal
          </em>
        </article>
        <article class="metric-card">
          <span class="metric-icon metric-icon--blue"><CheckCircle2 size={19} /></span>
          <div><span>Target alignment</span><strong>{adherence}<small>%</small></strong></div>
          <em class="steady">{loggedDays.length}/{range} days logged</em>
        </article>
      </section>

      <section class="insights-grid">
        <article class="card energy-trend-card">
          <div class="section-heading">
            <div><span class="eyebrow">Energy trend</span><h2>Calories by day</h2></div>
            <span class="chart-legend"><i /> Daily total <i /> Target</span>
          </div>
          <EnergyChart days={days} goal={profile.goals.calories} />
        </article>

        <article class="card weekly-summary-card">
          <div class="summary-orbit">
            <svg viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="50" />
              <circle cx="60" cy="60" r="50" pathLength="100" stroke-dasharray={`${adherence} 100`} />
            </svg>
            <div><strong>{adherence}%</strong><span>aligned</span></div>
          </div>
          <span class="eyebrow eyebrow--light">Your report</span>
          <h2>{adherence >= 80 ? 'A steady, balanced rhythm' : adherence >= 55 ? 'A useful week of learning' : 'Keep collecting the signal'}</h2>
          <p>
            You logged {loggedDays.length} of the last {range} days. Your average is {formatNumber(Math.abs(average.calories - profile.goals.calories))} kcal {average.calories > profile.goals.calories ? 'above' : 'below'} your target.
          </p>
          <div class="summary-date"><CalendarRange size={16} /> Ending {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date())}</div>
        </article>
      </section>

      <section class="guidance-section">
        <div class="section-heading">
          <div><span class="eyebrow">Next best choices</span><h2>Guidance from your recent days</h2></div>
          <span class="estimate-note"><Sparkles size={14} /> Deterministic, goal-based guidance</span>
        </div>
        <div class="recommendation-grid">
          {recommendations.map((item, index) => (
            <article class={`recommendation recommendation--${item.tone}`} key={item.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{item.title}</h3><p>{item.body}</p></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
