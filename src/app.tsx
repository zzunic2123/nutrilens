import { useCallback, useEffect, useState } from 'preact/hooks'
import { registerSW } from 'virtual:pwa-register'
import type { AppPage, ComposerMealSource, Meal } from './types'
import { AppShell } from './components/AppShell'
import { LoadingScreen, ToastViewport, WorkspaceError } from './components/Feedback'
import { MealComposer } from './components/MealComposer'
import { MealDetailModal } from './components/MealDetailModal'
import { useApp } from './contexts/AppContext'
import { todayKey } from './lib/date'
import { LoginPage } from './pages/LoginPage'
import { TodayPage } from './pages/TodayPage'
import { InsightsPage } from './pages/InsightsPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { SettingsPage } from './pages/SettingsPage'

const pages: AppPage[] = ['today', 'insights', 'leaderboard', 'settings']

function pageFromHash(): AppPage {
  const candidate = window.location.hash.replace(/^#\/?/, '').split(/[?&]/)[0]
  return pages.includes(candidate as AppPage) ? (candidate as AppPage) : 'today'
}

export function App() {
  const { session, profile, meals, loading, demoMode, dataError, refresh, signOut, notify } = useApp()
  const [page, setPage] = useState<AppPage>(pageFromHash)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerMode, setComposerMode] = useState<ComposerMealSource | null>(null)
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null)
  const [composerDate, setComposerDate] = useState(() => todayKey(profile.timezone))
  const [selectedDate, setSelectedDate] = useState(() => todayKey(profile.timezone))

  const navigate = useCallback((nextPage: AppPage) => {
    setPage(nextPage)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${nextPage}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const openComposer = useCallback((mode?: ComposerMealSource, dateKey = todayKey(profile.timezone)) => {
    setComposerMode(mode ?? null)
    setComposerDate(dateKey)
    setComposerOpen(true)
  }, [profile.timezone])
  const closeComposer = useCallback(() => setComposerOpen(false), [])
  const openMeal = useCallback((meal: Meal) => setSelectedMealId(meal.id), [])
  const closeMeal = useCallback(() => setSelectedMealId(null), [])
  const selectedMeal = selectedMealId ? meals.find((meal) => meal.id === selectedMealId) ?? null : null

  useEffect(() => {
    const handleHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if (!composerOpen && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openComposer()
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [composerOpen, openComposer])

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        notify({ tone: 'info', title: 'A fresh version is ready', detail: 'Reload the page to update NutriLens.' })
      },
      onOfflineReady() {
        notify({ tone: 'success', title: 'NutriLens is ready offline', detail: 'The app shell will open without a connection.' })
      },
    })
    return () => updateSW(false)
  }, [notify])

  useEffect(() => {
    setSelectedDate(todayKey(profile.timezone))
  }, [profile.timezone])

  if (loading) return <><LoadingScreen /><ToastViewport /></>
  if (!session && !demoMode) return <><LoginPage /><ToastViewport /></>
  if (session && !demoMode && dataError) {
    return <><WorkspaceError message={dataError} onRetry={() => void refresh()} onSignOut={() => void signOut()} /><ToastViewport /></>
  }

  return (
    <>
      <AppShell activePage={page} onNavigate={navigate} onAdd={() => openComposer()}>
        {page === 'today' && (
          <TodayPage
            selectedDate={selectedDate}
            onSelectedDate={setSelectedDate}
            onAdd={(mode) => openComposer(mode, selectedDate)}
            onShowInsights={() => navigate('insights')}
            onOpenMeal={openMeal}
          />
        )}
        {page === 'insights' && <InsightsPage />}
        {page === 'leaderboard' && <LeaderboardPage />}
        {page === 'settings' && <SettingsPage />}
      </AppShell>
      <MealComposer
        open={composerOpen}
        initialMode={composerMode}
        initialDateKey={composerDate}
        onClose={closeComposer}
      />
      <MealDetailModal meal={selectedMeal} onClose={closeMeal} />
      <ToastViewport />
    </>
  )
}
