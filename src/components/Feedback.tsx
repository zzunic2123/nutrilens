import { AlertCircle, CheckCircle2, Info, X } from 'lucide-preact'
import { useApp } from '../contexts/AppContext'
import { Brand } from './Brand'

export function ToastViewport() {
  const { toasts, dismissToast } = useApp()
  return (
    <div class="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? AlertCircle : Info
        return (
          <div class={`toast toast--${toast.tone}`} key={toast.id} role="status">
            <Icon size={19} aria-hidden="true" />
            <div>
              <strong>{toast.title}</strong>
              {toast.detail && <span>{toast.detail}</span>}
            </div>
            <button class="icon-button icon-button--small" onClick={() => dismissToast(toast.id)} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div class="loading-screen" aria-label="Loading NutriLens">
      <div class="loading-mark">
        <span />
        <span />
        <span />
      </div>
      <p>Preparing your day…</p>
    </div>
  )
}

export function WorkspaceError({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <main class="workspace-error-page">
      <Brand />
      <section class="workspace-error-card">
        <span><AlertCircle size={24} /></span>
        <p class="eyebrow">Sign-in completed</p>
        <h1>This account cannot open the workspace yet.</h1>
        <p>
          Ask the owner to add your exact Google email to <code>allowed_users</code>. If you are already invited, this may be a temporary connection problem.
        </p>
        <small>{message}</small>
        <div>
          <button class="button button--primary" onClick={onRetry}>Try again</button>
          <button class="button button--secondary" onClick={onSignOut}>Use another account</button>
        </div>
      </section>
    </main>
  )
}
