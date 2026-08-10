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
        d="M15 25.8c0-7.2 5.3-12.9 13.1-13.8.8 7.9-3.8 13.8-13.1 13.8Z"
        fill="var(--brand-accent)"
      />
      <path
        d="M17.2 34.8c-.4-7.5 4.2-13.3 14.3-15.2.7 7.7-4 14.2-14.3 15.2Z"
        fill="#fff"
        fill-opacity=".96"
      />
      <path d="M16.5 35c2.1-6.2 6.1-11.2 12.3-15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
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
