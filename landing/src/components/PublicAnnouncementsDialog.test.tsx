import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PublicAnnouncementsDialog from './PublicAnnouncementsDialog'

const mocks = vi.hoisted(() => ({
  fetchPublicAnnouncements: vi.fn(),
}))

vi.mock('../lib/publicAnnouncements', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/publicAnnouncements')>()
  return { ...original, fetchPublicAnnouncements: mocks.fetchPublicAnnouncements }
})

describe('PublicAnnouncementsDialog', () => {
  beforeEach(() => {
    mocks.fetchPublicAnnouncements.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('loads public announcements only while open and restores focus after closing', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mocks.fetchPublicAnnouncements.mockResolvedValue([
      { id: 7, title: '维护通知', content: '今晚 23:00 进行短暂维护。' },
    ])
    const trigger = document.createElement('button')
    trigger.textContent = '公告'
    document.body.append(trigger)
    trigger.focus()

    const { rerender } = render(<PublicAnnouncementsDialog open onClose={onClose} />)

    expect(mocks.fetchPublicAnnouncements).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('维护通知')).toBeTruthy()
    expect(screen.getByText('今晚 23:00 进行短暂维护。')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '关闭公告' }))

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(<PublicAnnouncementsDialog open={false} onClose={onClose} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it('renders a retry action when the public announcement request fails', async () => {
    const user = userEvent.setup()
    mocks.fetchPublicAnnouncements
      .mockRejectedValueOnce(new TypeError('network unavailable'))
      .mockResolvedValueOnce([])

    render(<PublicAnnouncementsDialog open onClose={vi.fn()} />)

    expect((await screen.findByRole('alert')).textContent).toContain('暂时无法加载公告')
    await user.click(screen.getByRole('button', { name: '重新加载' }))
    expect(await screen.findByText('暂无公告')).toBeTruthy()
    expect(mocks.fetchPublicAnnouncements).toHaveBeenCalledTimes(2)
  })
})
