import { expect, test } from '@playwright/test'
import { seedConsole } from './fixtures/api'

test.describe('Console visual contracts', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop')
    await page.clock.setFixedTime(new Date('2026-08-16T12:00:00+08:00'))
    await seedConsole(page)
  })

  test('shell expanded in light mode and announcement table', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/admin/announcements')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading', { name: '公告管理' })).toBeVisible()
    await expect(page.getByText('稳定版本发布公告')).toBeVisible()
    await expect(page).toHaveScreenshot('console-shell-light-expanded.png')
  })

  test('shell collapsed in dark mode', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/admin/announcements')
    await page.evaluate(() => document.fonts.ready)
    await page.getByRole('button', { name: '深色模式' }).click()
    await page.getByRole('button', { name: '收起侧边栏' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('aside')).toHaveClass(/w-\[72px\]/)
    await expect(page).toHaveScreenshot('console-shell-dark-collapsed.png')
  })

  test('announcement editor dialog', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/admin/announcements')
    await page.evaluate(() => document.fonts.ready)
    await page.getByRole('button', { name: '创建公告' }).click()
    const dialog = page.getByRole('dialog', { name: '创建公告' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveScreenshot('console-announcement-editor.png')
  })

  test('channel status v1', async ({ page }) => {
    await page.unroute('**/api/v1/**')
    await seedConsole(page, 'v1')
    await page.goto('http://127.0.0.1:4173/monitor')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByText('OpenAI 主线路')).toBeVisible()
    await expect(page.getByText('OPERATIONAL')).toBeVisible()
    await expect(page).toHaveScreenshot('console-channel-status-v1.png')
  })

  test('channel status v2', async ({ page }) => {
    await page.goto('http://127.0.0.1:4173/monitor')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByText('gpt-5').first()).toBeVisible()
    await expect(page).toHaveScreenshot('console-channel-status-v2.png')
  })
})
