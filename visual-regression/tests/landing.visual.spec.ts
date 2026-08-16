import { expect, test } from '@playwright/test'
import { seedLanding } from './fixtures/api'

test.describe('Landing visual contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-08-16T12:00:00+08:00'))
  })

  test('desktop public announcements', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop')
    await seedLanding(page)
    await page.goto('http://127.0.0.1:4174')
    await expect(page.locator('[data-visual-ready="true"]')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await page.getByRole('button', { name: '公告' }).click()
    const dialog = page.getByRole('dialog', { name: '公告' })
    await expect(dialog.getByText('稳定版本发布公告')).toBeVisible()
    await expect(page).toHaveScreenshot('landing-public-announcements.png')
  })

  test('desktop active-probe status', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop')
    await seedLanding(page, { status: 'active_probe' })
    await page.goto('http://127.0.0.1:4174/#status')
    await page.evaluate(() => document.fonts.ready)
    const status = page.locator('#status')
    await expect(status.getByText('99.92%')).toBeVisible()
    await expect(status).toHaveScreenshot('landing-active-probe-status.png')
  })

  test('mobile traffic degraded status', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile')
    await seedLanding(page, { status: 'traffic' })
    await page.goto('http://127.0.0.1:4174/#status')
    await page.evaluate(() => document.fonts.ready)
    const status = page.locator('#status')
    await expect(status.getByText('TTFT P50')).toBeVisible()
    await expect(status).toHaveScreenshot('landing-mobile-traffic-status.png')
  })

  test('mobile status error and retry', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-mobile')
    await seedLanding(page, { status: 'error' })
    await page.goto('http://127.0.0.1:4174/#status')
    await page.evaluate(() => document.fonts.ready)
    const status = page.locator('#status')
    await expect(status.getByRole('button', { name: '重新读取' })).toBeVisible()
    await expect(status).toHaveScreenshot('landing-mobile-status-error.png')
  })
})
