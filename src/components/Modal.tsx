import type { ComponentChildren } from 'preact'
import { createPortal } from 'preact/compat'
import { useEffect, useRef } from 'preact/hooks'
import { X } from 'lucide-preact'

interface ModalProps {
  open: boolean
  title: string
  eyebrow?: string
  onClose: () => void
  children: ComponentChildren
  wide?: boolean
  closeLabel?: string
}

export function Modal({ open, title, eyebrow, onClose, children, wide = false, closeLabel = 'Close' }: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => element.offsetParent !== null)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    const focusFrame = window.requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>(
        '[autofocus], .modal-body button:not(:disabled), .modal-body input:not(:disabled), .modal-body textarea:not(:disabled), .modal-header button',
      )
      preferred?.focus()
    })
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
      previouslyFocused?.focus()
    }
  }, [onClose, open])

  if (!open) return null
  return createPortal(
    <div class="modal-layer">
      <button class="modal-backdrop" aria-label={closeLabel} onClick={onClose} />
      <section ref={dialogRef} class={`modal-card${wide ? ' modal-card--wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-header">
          <div>
            {eyebrow && <span class="eyebrow">{eyebrow}</span>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button class="icon-button" onClick={onClose} aria-label={closeLabel}>
            <X size={20} />
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
