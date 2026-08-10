export interface PublicSettings {
  siteName: string
  siteLogo: string
  siteSubtitle: string
  docUrl: string
  registrationEnabled: boolean
}

type UnknownRecord = Record<string, unknown>

export const DEFAULT_PUBLIC_SETTINGS: Readonly<PublicSettings> = Object.freeze({
  siteName: '零一 API',
  siteLogo: '',
  siteSubtitle: '从零到一，连接每一次模型调用。',
  docUrl: '',
  registrationEnabled: true,
})

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function asNonEmptyString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

/** Accept only values safe to use as an external document href. */
export function sanitizeHttpUrl(value: unknown): string {
  const candidate = asNonEmptyString(value)
  if (!candidate) return ''

  try {
    const parsed = new URL(candidate)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : ''
  } catch {
    return ''
  }
}

/** Mirrors the console's branding policy without allowing protocol-relative URLs. */
export function sanitizeImageUrl(value: unknown): string {
  const candidate = asNonEmptyString(value)
  if (!candidate) return ''

  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate
  if (/^data:image\/(?:avif|gif|jpe?g|png|svg\+xml|webp);/i.test(candidate)) return candidate
  return sanitizeHttpUrl(candidate)
}

export function normalizePublicSettings(payload: unknown): PublicSettings {
  const response = asRecord(payload)
  if (!response || (typeof response.code === 'number' && response.code !== 0)) {
    return { ...DEFAULT_PUBLIC_SETTINGS }
  }

  const data = asRecord(response.data)
  if (!data) return { ...DEFAULT_PUBLIC_SETTINGS }

  return {
    siteName: asNonEmptyString(data.site_name, DEFAULT_PUBLIC_SETTINGS.siteName),
    siteLogo: sanitizeImageUrl(data.site_logo),
    siteSubtitle: asNonEmptyString(data.site_subtitle, DEFAULT_PUBLIC_SETTINGS.siteSubtitle),
    docUrl: sanitizeHttpUrl(data.doc_url),
    registrationEnabled:
      typeof data.registration_enabled === 'boolean'
        ? data.registration_enabled
        : DEFAULT_PUBLIC_SETTINGS.registrationEnabled,
  }
}

export async function fetchPublicSettings(
  request: typeof fetch = fetch,
  endpoint = '/api/v1/settings/public',
): Promise<PublicSettings> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 3_000)

  try {
    const response = await request(endpoint, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) return { ...DEFAULT_PUBLIC_SETTINGS }
    return normalizePublicSettings(await response.json())
  } catch {
    return { ...DEFAULT_PUBLIC_SETTINGS }
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}
