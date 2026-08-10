import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PUBLIC_SETTINGS,
  fetchPublicSettings,
  normalizePublicSettings,
  sanitizeHttpUrl,
  sanitizeImageUrl,
} from './publicSettings'

describe('public settings normalization', () => {
  it('uses supplied, safe public settings', () => {
    expect(
      normalizePublicSettings({
        code: 0,
        data: {
          site_name: '零一 API',
          site_logo: 'https://cdn.01yapi.com/logo.svg',
          site_subtitle: '稳定的模型调用入口。',
          doc_url: 'https://docs.01yapi.com/guide',
          registration_enabled: false,
        },
      }),
    ).toEqual({
      siteName: '零一 API',
      siteLogo: 'https://cdn.01yapi.com/logo.svg',
      siteSubtitle: '稳定的模型调用入口。',
      docUrl: 'https://docs.01yapi.com/guide',
      registrationEnabled: false,
    })
  })

  it('falls back when the response is malformed or unsuccessful', () => {
    expect(normalizePublicSettings({ code: 500, data: {} })).toEqual(DEFAULT_PUBLIC_SETTINGS)
    expect(normalizePublicSettings({ code: 0, data: null })).toEqual(DEFAULT_PUBLIC_SETTINGS)
  })

  it('rejects unsafe document and logo URLs', () => {
    expect(sanitizeHttpUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeImageUrl('//untrusted.example/logo.svg')).toBe('')
    expect(sanitizeImageUrl('/logo.svg')).toBe('/logo.svg')
  })

  it('falls back when the public settings request fails', async () => {
    const failedRequest = async () => {
      throw new TypeError('network unavailable')
    }

    await expect(fetchPublicSettings(failedRequest as typeof fetch)).resolves.toEqual(
      DEFAULT_PUBLIC_SETTINGS,
    )
  })

  it('falls back when the public settings response is not successful', async () => {
    const rejectedResponse = async () => new Response(null, { status: 503 })

    await expect(fetchPublicSettings(rejectedResponse as typeof fetch)).resolves.toEqual(
      DEFAULT_PUBLIC_SETTINGS,
    )
  })
})
