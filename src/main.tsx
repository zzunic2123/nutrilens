import { render } from 'preact'
import '@fontsource-variable/manrope'
import './index.css'
import { App } from './app.tsx'
import { AppProvider } from './contexts/AppContext.tsx'
import { applyThemePreference, getThemePreference } from './lib/theme.ts'

applyThemePreference(getThemePreference())

render(
  <AppProvider>
    <App />
  </AppProvider>,
  document.getElementById('app')!,
)
