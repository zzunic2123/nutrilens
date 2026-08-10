import { APP_NAME } from '../lib/constants'

export function AppMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      class="app-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
    >
      <rect width="48" height="48" rx="15" fill="currentColor" />
      <path
        d="M24 13a11 11 0 1 1-9.5 5.5"
        stroke="#fff"
        stroke-width="4.2"
        stroke-linecap="round"
      />
      <circle cx="14.5" cy="18.5" r="3" fill="var(--brand-accent)" />
    </svg>
  )
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div class="brand" aria-label={APP_NAME}>
      <AppMark size={compact ? 36 : 42} />
      <div class="brand-copy">
        <strong>{APP_NAME}</strong>
        {!compact && <span>Eat with clarity</span>}
      </div>
    </div>
  )
}
