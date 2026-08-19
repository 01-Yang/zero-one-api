import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const read = (relativePath: string) => readFileSync(resolve(here, relativePath), 'utf8')

describe('redeem and benefit integration surface', () => {
  it('keeps user and admin routes registered', () => {
    const router = read('../../../router/index.ts')

    expect(router).toContain("path: '/redeem'")
    expect(router).toContain("path: '/admin/redeem'")
    expect(router).toContain("path: '/admin/promo-codes'")
  })

  it('keeps the standard-mode navigation entries visible', () => {
    const sidebar = read('../../../components/layout/AppSidebar.vue')

    expect(sidebar).toContain("{ path: '/redeem', label: t('nav.redeem')")
    expect(sidebar).toContain("{ path: '/admin/redeem', label: t('nav.redeemCodes')")
    expect(sidebar).toContain("{ path: '/admin/promo-codes', label: t('nav.promoCodes')")
  })

  it('keeps benefit, mystery-box, and promo-code behavior in their views', () => {
    const userRedeem = read('../../../views/user/RedeemView.vue')
    const adminRedeem = read('../../../views/admin/RedeemView.vue')
    const promoCodes = read('../../../views/admin/PromoCodesView.vue')

    expect(userRedeem).toContain("type === 'mystery_box'")
    expect(adminRedeem).toContain("openGenerateDialog('mystery_box')")
    expect(promoCodes).toContain('promo.create')
  })
})
