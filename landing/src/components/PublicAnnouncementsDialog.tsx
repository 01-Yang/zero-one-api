import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  fetchPublicAnnouncements,
  type PublicAnnouncement,
} from '../lib/publicAnnouncements'

interface PublicAnnouncementsDialogProps {
  open: boolean
  onClose: () => void
}

type RequestState =
  | { status: 'loading'; announcements: PublicAnnouncement[] }
  | { status: 'ready'; announcements: PublicAnnouncement[] }
  | { status: 'error'; announcements: PublicAnnouncement[] }

function focusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []

  return [...container.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('hidden') && !element.closest('[hidden]'))
}

export default function PublicAnnouncementsDialog({
  open,
  onClose,
}: PublicAnnouncementsDialogProps) {
  const [requestVersion, setRequestVersion] = useState(0)
  const [requestState, setRequestState] = useState<RequestState>({
    status: 'loading',
    announcements: [],
  })
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    let active = true
    setRequestState({ status: 'loading', announcements: [] })
    void fetchPublicAnnouncements()
      .then((announcements) => {
        if (active) setRequestState({ status: 'ready', announcements })
      })
      .catch(() => {
        if (active) setRequestState({ status: 'error', announcements: [] })
      })

    return () => {
      active = false
    }
  }, [open, requestVersion])

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const applicationRoot = document.getElementById('root')
    const rootWasInert = applicationRoot?.inert ?? false
    const previousOverflow = document.body.style.overflow

    if (applicationRoot) applicationRoot.inert = true
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus({ preventScroll: true })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const elements = focusableElements(dialogRef.current)
      if (!elements.length) {
        event.preventDefault()
        dialogRef.current?.focus({ preventScroll: true })
        return
      }

      const activeIndex = elements.indexOf(document.activeElement as HTMLElement)
      const wrapBackward = event.shiftKey && activeIndex <= 0
      const wrapForward = !event.shiftKey && activeIndex === elements.length - 1
      if (!wrapBackward && !wrapForward && activeIndex !== -1) return

      event.preventDefault()
      const destination = wrapBackward ? elements[elements.length - 1] : elements[0]
      destination?.focus({ preventScroll: true })
    }

    const keepFocusInDialog = (event: FocusEvent) => {
      if (dialogRef.current?.contains(event.target as Node)) return
      closeButtonRef.current?.focus({ preventScroll: true })
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', keepFocusInDialog)

    return () => {
      if (applicationRoot) applicationRoot.inert = rootWasInert
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', keepFocusInDialog)

      if (previouslyFocused?.isConnected && !previouslyFocused.closest('[hidden]')) {
        previouslyFocused.focus({ preventScroll: true })
        return
      }
      document.querySelector<HTMLElement>('.menu-button')?.focus({ preventScroll: true })
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const dialog = (
    <div
      className="public-announcements-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={dialogRef}
        id="public-announcements-dialog"
        className="public-announcements-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="public-announcements-title"
        tabIndex={-1}
      >
        <header className="public-announcements-header">
          <div>
            <p className="public-announcements-eyebrow">系统消息</p>
            <h2 id="public-announcements-title">公告</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="public-announcements-close"
            type="button"
            aria-label="关闭公告"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="public-announcements-body" aria-busy={requestState.status === 'loading'}>
          {requestState.status === 'loading' ? (
            <p className="public-announcements-status" role="status">正在加载公告…</p>
          ) : null}
          {requestState.status === 'error' ? (
            <div className="public-announcements-error" role="alert">
              <p>暂时无法加载公告，请稍后重试。</p>
              <button
                className="public-announcements-retry"
                type="button"
                onClick={() => setRequestVersion((version) => version + 1)}
              >
                重新加载
              </button>
            </div>
          ) : null}
          {requestState.status === 'ready' && requestState.announcements.length === 0 ? (
            <p className="public-announcements-empty">暂无公告</p>
          ) : null}
          {requestState.status === 'ready' && requestState.announcements.length > 0 ? (
            <ol className="public-announcements-list">
              {requestState.announcements.map((announcement) => (
                <li key={announcement.id} className="public-announcements-item">
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>
    </div>
  )

  return createPortal(dialog, document.body)
}
