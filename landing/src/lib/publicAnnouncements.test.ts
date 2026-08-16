import { describe, expect, it, vi } from 'vitest'
import {
  fetchPublicAnnouncements,
  normalizePublicAnnouncements,
} from './publicAnnouncements'

describe('public announcements', () => {
  it('accepts only the explicit public code/data envelope and safe text rows', () => {
    expect(
      normalizePublicAnnouncements({
        code: 0,
        data: [
          { id: 1, title: '  模型更新\n通知 ', content: '新模型已上线。\n欢迎试用。' },
          { id: 2, title: '', content: 'missing title' },
          { id: 3, title: 'Missing content', content: '\u0000' },
        ],
      }),
    ).toEqual([
      {
        id: 1,
        title: '模型更新 通知',
        content: '新模型已上线。\n欢迎试用。',
      },
    ])
    expect(normalizePublicAnnouncements({ code: 1, data: [] })).toEqual([])
    expect(normalizePublicAnnouncements({ code: 0, data: { items: [] } })).toEqual([])
  })

  it('requests only the anonymous public announcement feed', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ code: 0, data: [] }),
    )

    await expect(fetchPublicAnnouncements(request)).resolves.toEqual([])

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]?.[0]).toBe('/api/v1/announcements/public')
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      credentials: 'omit',
    })
  })

  it('rejects unavailable or malformed public responses', async () => {
    const unavailable = async () => new Response(null, { status: 503 })
    const malformed = async () => Response.json({ code: 0, data: null })

    await expect(fetchPublicAnnouncements(unavailable as typeof fetch)).rejects.toThrow()
    await expect(fetchPublicAnnouncements(malformed as typeof fetch)).rejects.toThrow()
  })

  it('treats an old backend without the public route as a retryable failure', async () => {
    const oldBackend = async () => new Response(null, { status: 404 })

    await expect(fetchPublicAnnouncements(oldBackend as typeof fetch)).rejects.toThrow(
      'Public announcements request failed',
    )
  })
})
