import { ArrowRight, Camera, ChartNoAxesCombined, Check, ShieldCheck, Sparkles } from 'lucide-preact'
import { useState } from 'preact/hooks'
import { Brand } from '../components/Brand'
import { useApp } from '../contexts/AppContext'

export function LoginPage() {
  const { configured, signInWithGoogle, startDemo, notify } = useApp()
  const [signingIn, setSigningIn] = useState(false)

  const handleSignIn = async () => {
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      notify({
        tone: 'error',
        title: 'Could not start sign-in',
        detail: error instanceof Error ? error.message : 'Please try again.',
      })
      setSigningIn(false)
    }
  }

  return (
    <main class="login-page">
      <section class="login-story">
        <div class="login-brand"><Brand /></div>
        <div class="login-story-copy">
          <span class="eyebrow eyebrow--light"><Sparkles size={14} /> A gentler food journal</span>
          <h1>Know what nourishes you, without the noise.</h1>
          <p>
            Photograph a plate or describe a meal. NutriLens turns it into a clear estimate you can review, adjust and learn from.
          </p>
          <div class="login-benefits">
            <span><Camera size={18} /><strong>Photo-first logging</strong><small>Go from plate to estimate in moments.</small></span>
            <span><ChartNoAxesCombined size={18} /><strong>Calm, useful trends</strong><small>See patterns—not judgement.</small></span>
            <span><ShieldCheck size={18} /><strong>Your data stays yours</strong><small>Protected per user with Supabase RLS.</small></span>
          </div>
        </div>
        <div class="login-orbit login-orbit--one" />
        <div class="login-orbit login-orbit--two" />
      </section>

      <section class="login-panel">
        <div class="login-panel-brand"><Brand /></div>
        <div class="login-card">
          <div class="login-card-heading">
            <span class="login-icon"><Sparkles size={22} /></span>
            <h2>Welcome to NutriLens</h2>
            <p>Sign in to keep your meals, targets and weekly progress in sync.</p>
          </div>

          {configured ? (
            <button class="button button--google button--full" onClick={handleSignIn} disabled={signingIn}>
              <span class="google-mark">G</span>
              {signingIn ? 'Opening Google…' : 'Continue with Google'}
              {!signingIn && <ArrowRight size={18} />}
            </button>
          ) : (
            <div class="setup-notice">
              <strong>Backend setup is still needed</strong>
              <p>Add your Supabase values to <code>.env</code> when you are ready to connect real accounts.</p>
            </div>
          )}

          <div class="login-divider"><span>or explore first</span></div>
          <button class="button button--secondary button--full" onClick={startDemo}>
            Preview with sample data
            <ArrowRight size={18} />
          </button>

          <div class="login-trust">
            <Check size={15} /> No credit card
            <Check size={15} /> No photo storage
            <Check size={15} /> Invite-only
          </div>
          <p class="login-legal">Nutrition values are estimates and are not medical advice.</p>
        </div>
      </section>
    </main>
  )
}
