import { fireEvent, render, screen } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    profile: { displayName: 'Alex Morgan', email: 'alex@example.com' },
    demoMode: false,
  }),
}))

describe('AppShell navigation', () => {
  it('replaces the duplicate Settings item with Leaderboard while Profile still opens settings', () => {
    const navigate = vi.fn()
    render(<AppShell activePage="today" onNavigate={navigate} onAdd={vi.fn()}>Content</AppShell>)

    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Leaderboard' })[0])
    expect(navigate).toHaveBeenCalledWith('leaderboard')

    fireEvent.click(screen.getByRole('button', { name: /Alex Morgan/ }))
    expect(navigate).toHaveBeenCalledWith('settings')
  })
})
