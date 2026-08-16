import { ExternalLink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { sanitizeLandingNoticeUrl } from '../lib/publicSettings'

const STORAGE_KEY = 'zero-one:landing-notice-dismissed'

interface AnnouncementBarProps {
  enabled: boolean
  text: string
  url: string
}

function readDismissedFingerprint(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function AnnouncementBar({ enabled, text, url }: AnnouncementBarProps) {
  const normalizedText = text.trim().slice(0, 160)
  const safeUrl = sanitizeLandingNoticeUrl(url)
  const fingerprint = JSON.stringify([normalizedText, safeUrl])
  const [visible, setVisible] = useState(
    () => enabled && Boolean(normalizedText) && readDismissedFingerprint() !== fingerprint,
  )

  useEffect(() => {
    setVisible(enabled && Boolean(normalizedText) && readDismissedFingerprint() !== fingerprint)
  }, [enabled, fingerprint, normalizedText])

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, fingerprint)
    } catch {
      // Storage can be unavailable in strict privacy modes; closing still works for this view.
    }
    setVisible(false)
  }

  const external = /^https?:\/\//i.test(safeUrl)

  return (
    <aside className="announcement-bar" aria-label="站点公告">
      <div className="announcement-inner">
        <p>{normalizedText}</p>
        {safeUrl ? (
          <a href={safeUrl} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
            查看详情
            <ExternalLink aria-hidden="true" />
          </a>
        ) : null}
        <button type="button" aria-label="关闭公告" onClick={dismiss}>
          <X aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}
