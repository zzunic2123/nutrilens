import { describe, expect, it } from 'vitest'
import { recentDateKeys, shiftDateKey, toDateKey } from './date'

describe('date helpers', () => {
  it('uses the configured timezone at UTC day boundaries', () => {
    expect(toDateKey('2026-01-01T23:30:00Z', 'Europe/Zagreb')).toBe('2026-01-02')
    expect(toDateKey('2026-08-01T22:30:00Z', 'Europe/Zagreb')).toBe('2026-08-02')
  })

  it('moves calendar keys without local timezone drift', () => {
    expect(shiftDateKey('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDateKey('2026-10-25', -1)).toBe('2026-10-24')
  })

  it('returns an inclusive recent date range', () => {
    expect(recentDateKeys(3, '2026-08-10')).toEqual(['2026-08-08', '2026-08-09', '2026-08-10'])
  })
})
