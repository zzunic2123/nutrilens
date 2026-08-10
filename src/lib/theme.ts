import { APP_STORAGE_KEYS } from './constants'

export type Theme = 'light' | 'dark' | 'system'

export function getThemePreference(): Theme {
  const stored = localStorage.getItem(APP_STORAGE_KEYS.theme)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function applyThemePreference(theme: Theme): void {
  const resolved = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : theme
  document.documentElement.dataset.theme = resolved
}
