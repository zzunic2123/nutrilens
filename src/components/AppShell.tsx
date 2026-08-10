import type { ComponentChildren } from 'preact'
import { BarChart3, Bell, CalendarDays, Plus, Settings2, Sparkles } from 'lucide-preact'
import type { AppPage } from '../types'
import { useApp } from '../contexts/AppContext'
import { initials } from '../lib/format'
import { Brand } from './Brand'

interface AppShellProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  onAdd: () => void
  children: ComponentChildren
}

const navItems = [
  { page: 'today' as const, label: 'Today', icon: CalendarDays },
  { page: 'insights' as const, label: 'Insights', icon: BarChart3 },
  { page: 'settings' as const, label: 'Settings', icon: Settings2 },
]

export function AppShell({ activePage, onNavigate, onAdd, children }: AppShellProps) {
  const { profile, demoMode } = useApp()
  return (
    <div class="app-shell">
      <aside class="sidebar">
        <Brand />
        <nav class="sidebar-nav" aria-label="Main navigation">
          {navItems.map(({ page, label, icon: Icon }) => (
            <button
              class={`nav-item${activePage === page ? ' nav-item--active' : ''}`}
              onClick={() => onNavigate(page)}
              aria-current={activePage === page ? 'page' : undefined}
              key={page}
            >
              <Icon size={20} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button class="sidebar-add" onClick={onAdd}>
          <Plus size={20} />
          Log a meal
          <span>⌘ K</span>
        </button>
        <div class="sidebar-spacer" />
        <div class="mindful-card">
          <span class="mindful-icon"><Sparkles size={18} /></span>
          <strong>Small choices add up</strong>
          <p>Consistency matters more than a perfect day.</p>
        </div>
        <button class="profile-chip" onClick={() => onNavigate('settings')}>
          <span class="avatar">{initials(profile.displayName)}</span>
          <span>
            <strong>{profile.displayName}</strong>
            <small>{demoMode ? 'Demo workspace' : profile.email}</small>
          </span>
          <Settings2 size={17} />
        </button>
      </aside>

      <div class="app-frame">
        <header class="mobile-header">
          <Brand compact />
          <div class="mobile-header-actions">
            {demoMode && <span class="demo-pill">Demo</span>}
            <button class="icon-button icon-button--ghost" aria-label="Notifications" onClick={() => onNavigate('settings')}>
              <Bell size={20} />
            </button>
          </div>
        </header>
        <main class="app-main">{children}</main>
      </div>

      <nav class="bottom-nav" aria-label="Mobile navigation">
        {navItems.slice(0, 2).map(({ page, label, icon: Icon }) => (
          <button class={activePage === page ? 'active' : ''} onClick={() => onNavigate(page)} key={page}>
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
        <button class="bottom-add" onClick={onAdd} aria-label="Add meal">
          <span><Plus size={25} /></span>
          <small>Add</small>
        </button>
        <button class={activePage === 'settings' ? 'active' : ''} onClick={() => onNavigate('settings')}>
          <Settings2 size={21} />
          <span>Settings</span>
        </button>
        <button onClick={() => onNavigate('settings')}>
          <span class="mini-avatar">{initials(profile.displayName)}</span>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  )
}
