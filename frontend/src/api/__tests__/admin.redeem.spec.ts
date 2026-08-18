import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('@/api/client', () => ({
  apiClient: { post }
}))

import { generate } from '@/api/admin/redeem'

describe('admin redeem code generation API', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue({ data: [] })
  })

  it('sends a fixed-value benefit batch request', async () => {
    await generate(10, 'benefit', 5, undefined, undefined, 7)

    expect(post).toHaveBeenCalledWith('/admin/redeem-codes/generate', {
      count: 10,
      type: 'benefit',
      value: 5,
      expires_in_days: 7
    })
  })

  it('sends the inclusive mystery-box reward range', async () => {
    await generate(10, 'mystery_box', 0, undefined, undefined, undefined, 1.25, 8.75)

    expect(post).toHaveBeenCalledWith('/admin/redeem-codes/generate', {
      count: 10,
      type: 'mystery_box',
      value: 0,
      min_value: 1.25,
      max_value: 8.75
    })
  })
})
