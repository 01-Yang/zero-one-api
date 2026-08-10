import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { DEFAULT_PUBLIC_SETTINGS, type PublicSettings } from './lib/publicSettings'

const mocks = vi.hoisted(() => ({
  fetchPublicSettings: vi.fn(),
}))

vi.mock('./components/Threads', () => ({
  default: () => <div data-testid="threads" aria-hidden="true" />,
}))

vi.mock('./lib/publicSettings', async (importOriginal) => {
  const original = await importOriginal<typeof import('./lib/publicSettings')>()
  return {
    ...original,
    fetchPublicSettings: mocks.fetchPublicSettings,
  }
})

const settings = (overrides: Partial<PublicSettings> = {}): PublicSettings => ({
  ...DEFAULT_PUBLIC_SETTINGS,
  ...overrides,
})

describe('public site', () => {
  beforeEach(() => {
    mocks.fetchPublicSettings.mockReset()
    mocks.fetchPublicSettings.mockResolvedValue(settings())
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders safe public settings and hides registration when disabled', async () => {
    mocks.fetchPublicSettings.mockResolvedValue(
      settings({
        siteName: '零一 API 测试站',
        siteSubtitle: '稳定的模型调用入口。',
        docUrl: 'https://docs.01yapi.com/guide',
        registrationEnabled: false,
      }),
    )

    render(<App />)

    expect(await screen.findByText('稳定的模型调用入口。')).toBeTruthy()
    expect(screen.getByRole('link', { name: '零一 API 测试站 首页' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: '文档' })[0]?.getAttribute('href')).toBe(
      'https://docs.01yapi.com/guide',
    )
    expect(screen.queryByRole('link', { name: '注册' })).toBeNull()
    expect(screen.queryByRole('link', { name: '注册账号' })).toBeNull()
  })

  it('opens and closes the mobile navigation with accessible state', async () => {
    const user = userEvent.setup()
    render(<App />)

    const menuButton = screen.getByRole('button', { name: '打开导航' })
    expect(menuButton.getAttribute('aria-expanded')).toBe('false')

    await user.click(menuButton)
    expect(screen.getByRole('button', { name: '关闭导航' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
    expect(screen.getByRole('navigation', { name: '移动导航' })).toBeTruthy()

    const firstMobileLink = screen
      .getByRole('navigation', { name: '移动导航' })
      .querySelector('a')!
    firstMobileLink.addEventListener('click', (event) => event.preventDefault(), { once: true })
    await user.click(firstMobileLink)
    expect(screen.getByRole('button', { name: '打开导航' }).getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  it('copies the canonical API endpoint and announces success', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<App />)

    await user.click(screen.getByRole('button', { name: '复制 API 地址' }))

    expect(writeText).toHaveBeenCalledWith('https://api.01yapi.com')
    expect(screen.getByRole('status').textContent).toBe('已复制')
    expect(screen.getByRole('button', { name: 'API 地址已复制' })).toBeTruthy()
  })

  it('falls back to the text wordmark when a configured logo fails', async () => {
    mocks.fetchPublicSettings.mockResolvedValue(
      settings({ siteLogo: 'https://cdn.01yapi.com/missing-logo.svg' }),
    )
    render(<App />)

    await waitFor(() => expect(document.querySelector('.wordmark-logo')).not.toBeNull())
    const logo = document.querySelector<HTMLImageElement>('.wordmark-logo')!

    fireEvent.error(logo)
    await waitFor(() => expect(document.querySelector('.wordmark-logo')).toBeNull())
    expect(screen.getByRole('link', { name: '零一 API 首页' })).toBeTruthy()
  })
})
