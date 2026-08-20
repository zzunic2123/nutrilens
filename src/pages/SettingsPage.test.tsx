import { fireEvent, render, screen, waitFor } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../types'
import { SettingsPage } from './SettingsPage'

const mocks = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  notify: vi.fn(),
}))

const profile: Profile = {
  id: 'user-1',
  email: 'user@example.com',
  displayName: 'Alex',
  goals: { calories: 2200, protein: 140, carbs: 245, fat: 70, fiber: 30 },
  timezone: 'Europe/Zagreb',
  pushEnabled: false,
}

vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    profile,
    demoMode: true,
    configured: false,
    saveProfile: mocks.saveProfile,
    enablePush: vi.fn(),
    disablePush: vi.fn(),
    signOut: vi.fn(),
    resetDemo: vi.fn(),
    notify: mocks.notify,
  }),
}))

describe('SettingsPage', () => {
  beforeEach(() => {
    mocks.saveProfile.mockReset().mockResolvedValue(undefined)
    mocks.notify.mockReset()
    localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  it('sends edited nutrition goals through the profile save path', async () => {
    render(<SettingsPage />)

    fireEvent.input(screen.getByRole('spinbutton', { name: 'Calories kcal' }), { target: { value: '2350' } })
    fireEvent.input(screen.getByRole('spinbutton', { name: 'Protein grams' }), { target: { value: '155' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Save changes' })[0])

    await waitFor(() => expect(mocks.saveProfile).toHaveBeenCalledTimes(1))
    expect(mocks.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-1',
      goals: { calories: 2350, protein: 155, carbs: 245, fat: 70, fiber: 30 },
    }))
  })
})
