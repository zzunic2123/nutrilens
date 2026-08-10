import { Bell, Check, ChevronRight, Cloud, Info, Laptop, LogOut, Moon, RefreshCw, Save, ShieldCheck, Smartphone, Sun, UserRound } from 'lucide-preact'
import { useEffect, useState } from 'preact/hooks'
import type { Profile } from '../types'
import { useApp } from '../contexts/AppContext'
import { APP_STORAGE_KEYS, REMINDER_SCHEDULE } from '../lib/constants'
import { initials } from '../lib/format'
import { applyThemePreference, getThemePreference, type Theme } from '../lib/theme'

export function SettingsPage() {
  const { profile, demoMode, configured, saveProfile, enablePush, disablePush, signOut, resetDemo, notify } = useApp()
  const [form, setForm] = useState<Profile>(profile)
  const [saving, setSaving] = useState(false)
  const [changingPush, setChangingPush] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)
  const [theme, setTheme] = useState<Theme>(getThemePreference)
  const privacyUrl = import.meta.env.VITE_PRIVACY_URL?.trim()

  useEffect(() => setForm(profile), [profile])
  useEffect(() => {
    applyThemePreference(theme)
    localStorage.setItem(APP_STORAGE_KEYS.theme, theme)
    if (theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => applyThemePreference('system')
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [theme])

  const updateGoal = (key: keyof Profile['goals'], value: string) => {
    setForm((current) => ({
      ...current,
      goals: { ...current.goals, [key]: Number(value) || 0 },
    }))
  }

  const handleSave = async () => {
    if (!form.displayName.trim()) {
      notify({ tone: 'error', title: 'Please add your name' })
      return
    }
    if (Object.values(form.goals).some((value) => !Number.isFinite(value) || value <= 0)) {
      notify({ tone: 'error', title: 'Targets must be positive numbers' })
      return
    }
    setSaving(true)
    try {
      await saveProfile(form)
    } catch (error) {
      notify({ tone: 'error', title: 'Could not save settings', detail: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const togglePush = async () => {
    setChangingPush(true)
    try {
      if (profile.pushEnabled) await disablePush()
      else await enablePush()
    } catch (error) {
      notify({ tone: 'error', title: 'Could not change notifications', detail: error instanceof Error ? error.message : undefined })
    } finally {
      setChangingPush(false)
    }
  }

  return (
    <div class="page settings-page">
      <header class="page-heading">
        <div>
          <span class="eyebrow">Make it yours</span>
          <h1>Settings</h1>
          <p>Simple targets and quiet reminders. You can change these whenever your needs change.</p>
        </div>
        <button class="button button--primary desktop-add" onClick={() => void handleSave()} disabled={saving}>
          <Save size={18} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
      </header>

      <div class="settings-layout">
        <div class="settings-main">
          <section class="settings-section card">
            <div class="settings-section-heading">
              <span class="settings-icon"><UserRound size={19} /></span>
              <div><h2>Your profile</h2><p>How NutriLens should address you.</p></div>
            </div>
            <div class="profile-editor">
              <span class="profile-avatar-large">{initials(form.displayName)}</span>
              <div class="form-grid form-grid--two">
                <label class="field"><span>Display name</span><input value={form.displayName} onInput={(event) => setForm({ ...form, displayName: event.currentTarget.value })} /></label>
                <label class="field"><span>Email</span><input value={form.email} disabled /><small>Managed by your sign-in provider</small></label>
              </div>
            </div>
          </section>

          <section class="settings-section card">
            <div class="settings-section-heading">
              <span class="settings-icon settings-icon--blue"><Cloud size={19} /></span>
              <div><h2>Daily nutrition targets</h2><p>Used for progress and deterministic guidance.</p></div>
            </div>
            <div class="goal-fields">
              <label class="field goal-field goal-field--calories"><span>Calories</span><div><input type="number" min="500" step="50" value={form.goals.calories} onInput={(event) => updateGoal('calories', event.currentTarget.value)} /><em>kcal</em></div></label>
              <label class="field goal-field goal-field--protein"><span>Protein</span><div><input type="number" min="1" value={form.goals.protein} onInput={(event) => updateGoal('protein', event.currentTarget.value)} /><em>grams</em></div></label>
              <label class="field goal-field goal-field--carbs"><span>Carbohydrates</span><div><input type="number" min="1" value={form.goals.carbs} onInput={(event) => updateGoal('carbs', event.currentTarget.value)} /><em>grams</em></div></label>
              <label class="field goal-field goal-field--fat"><span>Fat</span><div><input type="number" min="1" value={form.goals.fat} onInput={(event) => updateGoal('fat', event.currentTarget.value)} /><em>grams</em></div></label>
              <label class="field goal-field goal-field--fiber"><span>Fiber</span><div><input type="number" min="1" value={form.goals.fiber} onInput={(event) => updateGoal('fiber', event.currentTarget.value)} /><em>grams</em></div></label>
            </div>
            <div class="info-strip"><Info size={16} /><span>These values are personal goals, not clinical recommendations. Speak with a qualified professional for medical nutrition needs.</span></div>
          </section>

          <section class="settings-section card">
            <div class="settings-section-heading">
              <span class="settings-icon settings-icon--orange"><Bell size={19} /></span>
              <div><h2>Quiet reminders</h2><p>The same considerate schedule for everyone.</p></div>
              <button
                class={`toggle${profile.pushEnabled ? ' toggle--on' : ''}`}
                role="switch"
                aria-checked={profile.pushEnabled}
                onClick={() => void togglePush()}
                disabled={changingPush}
              ><span /></button>
            </div>
            <div class="reminder-list">
              {REMINDER_SCHEDULE.map((item) => (
                <div key={item.type}><span><Check size={14} /></span><strong>{item.label}</strong><time>{item.time}</time></div>
              ))}
              <div><span><Check size={14} /></span><strong>Weekly reflection</strong><time>Sun 20:00</time></div>
            </div>
            <small class="settings-caption">Times use Europe/Zagreb and automatically follow daylight-saving changes.</small>
          </section>
        </div>

        <aside class="settings-aside">
          <section class="card account-card">
            <div class="account-top"><span class="avatar">{initials(profile.displayName)}</span><div><strong>{profile.displayName}</strong><small>{demoMode ? 'Local demo workspace' : profile.email}</small></div></div>
            <div class={`connection-state${configured ? ' connection-state--ready' : ''}`}><span /><div><strong>{configured ? 'Supabase configured' : 'Demo-only mode'}</strong><small>{configured ? 'Ready for synced accounts' : 'Add .env values to connect'}</small></div></div>
          </section>

          <section class="card appearance-card">
            <span class="eyebrow">Appearance</span>
            <h3>Choose your light</h3>
            <div class="theme-picker">
              <button class={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={18} />Light</button>
              <button class={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={18} />Dark</button>
              <button class={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}><Laptop size={18} />Auto</button>
            </div>
          </section>

          <section class="card install-card">
            <span class="install-icon"><Smartphone size={20} /></span>
            <h3>Keep it one tap away</h3>
            <p>Install NutriLens on your home screen for a focused, app-like experience.</p>
            <button onClick={() => setShowInstallHelp((value) => !value)}>How to install <ChevronRight size={16} /></button>
            {showInstallHelp && <div class="install-help">Open your browser’s share or menu button, then choose <strong>Add to Home Screen</strong> or <strong>Install app</strong>.</div>}
          </section>

          <section class="settings-actions">
            {demoMode && <button onClick={resetDemo}><RefreshCw size={17} /> Reset sample data</button>}
            <button onClick={() => void signOut()}><LogOut size={17} /> {demoMode ? 'Exit demo' : 'Sign out'}</button>
          </section>
          <div class="privacy-note"><ShieldCheck size={17} /><p><strong>Privacy by design</strong><span>Meal photos are sent for analysis and are not saved in your database.</span>{privacyUrl && <a href={privacyUrl} target="_blank" rel="noreferrer">Read the privacy notice</a>}</p></div>
        </aside>
      </div>

      <button class="button button--primary mobile-save" onClick={() => void handleSave()} disabled={saving}>
        <Save size={18} /> {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
