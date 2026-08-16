export interface PublicAnnouncement {
  id: number
  title: string
  content: string
}

type UnknownRecord = Record<string, unknown>

const MAX_PUBLIC_ANNOUNCEMENTS = 20
const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 20_000

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function normalizeTitle(value: unknown): string {
  if (typeof value !== 'string') return ''
  return Array.from(value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim())
    .slice(0, MAX_TITLE_LENGTH)
    .join('')
}

function normalizeContent(value: unknown): string {
  if (typeof value !== 'string') return ''
  return Array.from(
    value
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
      .trim(),
  )
    .slice(0, MAX_CONTENT_LENGTH)
    .join('')
}

function normalizeAnnouncement(value: unknown): PublicAnnouncement | null {
  const announcement = asRecord(value)
  if (!announcement) return null

  const id = announcement.id
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) return null

  const title = normalizeTitle(announcement.title)
  const content = normalizeContent(announcement.content)
  return title && content ? { id, title, content } : null
}

function isSuccessfulEnvelope(payload: unknown): payload is UnknownRecord & { data: unknown[] } {
  const response = asRecord(payload)
  return response?.code === 0 && Array.isArray(response.data)
}

/**
 * Accept only the small, public response shape required by the landing page.
 * Invalid rows are discarded rather than rendered, so malformed API data never
 * becomes public page content.
 */
export function normalizePublicAnnouncements(payload: unknown): PublicAnnouncement[] {
  if (!isSuccessfulEnvelope(payload)) return []

  return payload.data
    .map(normalizeAnnouncement)
    .filter((announcement): announcement is PublicAnnouncement => announcement !== null)
    .slice(0, MAX_PUBLIC_ANNOUNCEMENTS)
}

/** Fetches the anonymous, explicitly public announcement feed; it never sends login credentials. */
export async function fetchPublicAnnouncements(
  request: typeof fetch = fetch,
  endpoint = '/api/v1/announcements/public',
): Promise<PublicAnnouncement[]> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 3_000)

  try {
    const response = await request(endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error('Public announcements request failed')

    const payload: unknown = await response.json()
    if (!isSuccessfulEnvelope(payload)) throw new Error('Invalid public announcements response')
    return normalizePublicAnnouncements(payload)
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}
