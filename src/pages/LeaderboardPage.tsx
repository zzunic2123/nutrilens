import {
  CalendarDays,
  ChevronRight,
  Crown,
  Info,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-preact'
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import type { ChampionRecord, LeaderboardEntry, LeaderboardOverview, LeaderboardPeriod, PlayerMealTimeline } from '../types'
import { PlayerMealModal } from '../components/PlayerMealModal'
import { useApp } from '../contexts/AppContext'
import { formatLongDate } from '../lib/date'
import { formatNumber, initials } from '../lib/format'
import { COMPETITION_PERIOD_OPTIONS, COMPETITION_PERIODS } from '../lib/leaderboard'

interface SelectedPlayer {
  userId: string
  displayName: string
  period: LeaderboardPeriod
  periodStart: string | null
}

function periodTitle(overview: LeaderboardOverview): string {
  if (overview.period === 'today') return formatLongDate(overview.startKey)
  if (overview.period === 'month') {
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' })
      .format(new Date(`${overview.startKey}T12:00:00Z`))
  }
  return `${formatLongDate(overview.startKey)} – ${formatLongDate(overview.endKey)}`
}

function participation(entry: LeaderboardEntry, period: LeaderboardPeriod): string {
  if (entry.score == null) return 'No calories logged yet'
  if (period === 'today') return `${entry.mealCount} ${entry.mealCount === 1 ? 'meal' : 'meals'} today`
  const required = COMPETITION_PERIODS[period].championLoggedDays
  return `${entry.loggedDays} of ${required} days · ${entry.eligible ? 'eligible' : 'provisional'}`
}

function ChampionCard({
  label,
  champions,
  onOpen,
}: {
  label: string
  champions: ChampionRecord[]
  onOpen: (champion: ChampionRecord) => void
}) {
  const champion = champions[0]
  return (
    <article class="champion-card">
      <span class="champion-crown"><Crown size={23} fill="currentColor" /></span>
      <div class="champion-card-label"><span>{label}</span>{champion && <small>{champion.startKey} – {champion.endKey}</small>}</div>
      {champion ? (
        <>
          <h3>{champions.map((winner) => winner.displayName).join(' & ')}</h3>
          <strong>{formatNumber(champion.score, 1)}<small>g / 1,000 kcal</small></strong>
          <button onClick={() => onOpen(champion)} disabled={!champion.userId}>
            View winning meals <ChevronRight size={15} />
          </button>
        </>
      ) : (
        <><h3>No Champion yet</h3><p>No Player met the participation threshold.</p></>
      )}
    </article>
  )
}

export function LeaderboardPage() {
  const { loadLeaderboard, loadLeaderboardPlayerMeals, notify } = useApp()
  const [period, setPeriod] = useState<LeaderboardPeriod>('week')
  const [overview, setOverview] = useState<LeaderboardOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null)
  const [timeline, setTimeline] = useState<PlayerMealTimeline | null>(null)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineLoadingMore, setTimelineLoadingMore] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)
  const timelineRequest = useRef(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setOverview(null)
    void loadLeaderboard(period).then((next) => {
      if (active) setOverview(next)
    }).catch((nextError) => {
      if (active) setError(nextError instanceof Error ? nextError.message : 'Could not load the leaderboard.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [loadLeaderboard, period, reloadToken])

  const openPlayer = useCallback((player: SelectedPlayer) => {
    const requestId = ++timelineRequest.current
    setSelectedPlayer(player)
    setTimeline(null)
    setTimelineError(null)
    setTimelineLoading(true)
    setTimelineLoadingMore(false)
    void loadLeaderboardPlayerMeals(player.userId, player.period, player.periodStart, null)
      .then((next) => {
        if (timelineRequest.current === requestId) setTimeline(next)
      })
      .catch((nextError) => {
        if (timelineRequest.current !== requestId) return
        const message = nextError instanceof Error ? nextError.message : 'Could not load this Player’s meals.'
        setTimelineError(message)
        notify({ tone: 'error', title: 'Public meal view unavailable', detail: message })
      })
      .finally(() => {
        if (timelineRequest.current === requestId) setTimelineLoading(false)
      })
  }, [loadLeaderboardPlayerMeals, notify])

  const closePlayer = useCallback(() => {
    timelineRequest.current += 1
    setSelectedPlayer(null)
    setTimeline(null)
    setTimelineError(null)
    setTimelineLoading(false)
    setTimelineLoadingMore(false)
  }, [])

  const selectPeriod = (nextPeriod: LeaderboardPeriod) => {
    closePlayer()
    setPeriod(nextPeriod)
  }

  const loadMoreHistory = () => {
    if (!overview || historyLoading || !overview.historyHasMore) return
    const requestedPeriod = period
    setHistoryLoading(true)
    void loadLeaderboard(requestedPeriod, overview.championHistory.length)
      .then((next) => {
        setOverview((current) => {
          if (!current || current.period !== requestedPeriod) return current
          const known = new Set(current.championHistory.map((champion) => champion.id))
          return {
            ...current,
            championHistory: [
              ...current.championHistory,
              ...next.championHistory.filter((champion) => !known.has(champion.id)),
            ],
            historyHasMore: next.historyHasMore,
          }
        })
      })
      .catch((nextError) => {
        const message = nextError instanceof Error ? nextError.message : 'Could not load older Champions.'
        notify({ tone: 'error', title: 'Trophy room unavailable', detail: message })
      })
      .finally(() => setHistoryLoading(false))
  }

  const loadMoreMeals = () => {
    if (!selectedPlayer || !timeline || timelineLoadingMore || !timeline.hasMore || !timeline.nextCursor) return
    const player = selectedPlayer
    const requestId = ++timelineRequest.current
    setTimelineLoadingMore(true)
    void loadLeaderboardPlayerMeals(
      player.userId,
      player.period,
      player.periodStart,
      timeline.nextCursor,
    ).then((next) => {
      if (timelineRequest.current !== requestId) return
      setTimeline((current) => current ? {
        ...current,
        meals: [...current.meals, ...next.meals],
        hasMore: next.hasMore,
        nextCursor: next.nextCursor,
      } : current)
    }).catch((nextError) => {
      if (timelineRequest.current !== requestId) return
      const message = nextError instanceof Error ? nextError.message : 'Could not load more meals.'
      notify({ tone: 'error', title: 'More meals unavailable', detail: message })
    }).finally(() => {
      if (timelineRequest.current === requestId) setTimelineLoadingMore(false)
    })
  }

  const openEntry = (entry: LeaderboardEntry) => openPlayer({
    userId: entry.userId,
    displayName: entry.displayName,
    period,
    periodStart: null,
  })

  const openChampion = (champion: ChampionRecord) => {
    if (!champion.userId) return
    openPlayer({
      userId: champion.userId,
      displayName: champion.displayName,
      period: champion.period,
      periodStart: champion.startKey,
    })
  }

  return (
    <div class="page leaderboard-page">
      <header class="page-heading leaderboard-heading">
        <div>
          <span class="eyebrow"><Sparkles size={13} /> The protein league</span>
          <h1>Leaderboard</h1>
          <p>More protein for every calorie. One crown, earned together in the open.</p>
        </div>
        <div class="leaderboard-period-tabs" role="group" aria-label="Competition period">
          {COMPETITION_PERIOD_OPTIONS.map((option) => (
            <button
              class={period === option.value ? 'active' : ''}
              aria-pressed={period === option.value}
              onClick={() => selectPeriod(option.value)}
              key={option.value}
            >{option.label}</button>
          ))}
        </div>
      </header>

      {overview && (
        <div class="leaderboard-period-title"><CalendarDays size={16} /><strong>{periodTitle(overview)}</strong><span>Europe/Zagreb</span></div>
      )}

      {error && (
        <div class="inline-alert inline-alert--error leaderboard-error">
          <div><strong>Competition data is unavailable.</strong><span>{error}</span></div>
          <button class="button button--small button--secondary" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={14} /> Try again</button>
        </div>
      )}

      {loading && !overview ? (
        <div class="leaderboard-loading"><LoaderCircle class="spin" size={27} /><span>Counting every gram…</span></div>
      ) : overview && (
        <>
          <section class="champion-section">
            <div class="section-heading">
              <div><span class="eyebrow">Reigning glory</span><h2>Champions to beat</h2></div>
              <Trophy size={20} />
            </div>
            <div class="champion-grid">
              <ChampionCard label="Last week" champions={overview.latestWeekChampions} onOpen={openChampion} />
              <ChampionCard label="Last month" champions={overview.latestMonthChampions} onOpen={openChampion} />
            </div>
          </section>

          <div class="leaderboard-content-grid">
            <section class="leaderboard-standing card">
              <div class="leaderboard-standing-heading">
                <div><span class="eyebrow">Live table</span><h2>{period === 'today' ? 'Today’s order' : `This ${period}`}</h2></div>
                <span>{overview.entries.length} {overview.entries.length === 1 ? 'Player' : 'Players'}</span>
              </div>
              <div class="leaderboard-list">
                {overview.entries.map((entry) => (
                  <button
                    class={`leaderboard-row${entry.rank === 1 && entry.score != null ? ' leaderboard-row--first' : ''}`}
                    aria-label={`Open ${entry.displayName}'s meals`}
                    onClick={() => openEntry(entry)}
                    key={entry.userId}
                  >
                    <span class="leaderboard-rank">{entry.rank === 1 && entry.score != null ? <Crown size={20} fill="currentColor" /> : entry.rank}</span>
                    <span class="leaderboard-avatar">{initials(entry.displayName)}</span>
                    <span class="leaderboard-player">
                      <strong>{entry.displayName}{entry.isCurrentUser && <small>You</small>}</strong>
                      <em>{participation(entry, period)}</em>
                    </span>
                    <span class="leaderboard-totals"><strong>{formatNumber(entry.protein)}g</strong><small>protein</small></span>
                    <span class="leaderboard-score"><strong>{entry.score == null ? '—' : formatNumber(entry.score, 1)}</strong><small>g / 1,000 kcal</small></span>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </section>

            <aside class="leaderboard-aside">
              <article class="card score-explainer">
                <span><Target size={20} /></span>
                <div><span class="eyebrow">The score</span><h3>Protein efficiency</h3></div>
                <p>Protein grams ÷ calories × 1,000. Weekly Champions need four logged days; monthly Champions need fifteen.</p>
                <small><Info size={13} /> Rankings use exact values before display rounding.</small>
              </article>

              <article class="card champion-history">
                <div class="section-heading compact"><div><span class="eyebrow">Trophy room</span><h3>Champion history</h3></div><Trophy size={18} /></div>
                {overview.championHistory.length > 0 ? (
                  <div class="champion-history-list">
                    {overview.championHistory.map((champion) => (
                      <button onClick={() => openChampion(champion)} disabled={!champion.userId} key={champion.id}>
                        <span><Crown size={14} fill="currentColor" /></span>
                        <p><strong>{champion.displayName}</strong><small>{champion.period === 'week' ? 'Weekly' : 'Monthly'} Champion · {champion.endKey}</small></p>
                        <em>{formatNumber(champion.score, 1)}</em>
                      </button>
                    ))}
                  </div>
                ) : <p class="champion-history-empty">The first trophies are waiting to be earned.</p>}
                {overview.historyHasMore && (
                  <button class="champion-history-more" onClick={loadMoreHistory} disabled={historyLoading}>
                    {historyLoading ? <LoaderCircle class="spin" size={14} /> : <Trophy size={14} />}
                    Load older Champions
                  </button>
                )}
              </article>
            </aside>
          </div>
        </>
      )}

      <PlayerMealModal
        player={selectedPlayer}
        timeline={timeline}
        loading={timelineLoading}
        loadingMore={timelineLoadingMore}
        error={timelineError}
        onLoadMore={loadMoreMeals}
        onClose={closePlayer}
      />
    </div>
  )
}
