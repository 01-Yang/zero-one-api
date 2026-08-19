import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const read = (path: string) => readFileSync(resolve(frontendRoot, path), 'utf8')

describe('Console Skin module boundary', () => {
  it('owns the shared shell, navigation, dialog, select, and table surfaces', () => {
    const skin = read('src/styles/console-skin.css')

    expect(skin).toContain('.console-skin-shell')
    expect(skin).toContain('.console-skin-header')
    expect(skin).toContain('.console-skin-sidebar')
    expect(skin).toContain('.console-skin-dialog')
    expect(skin).toContain('.console-skin-select-trigger')
    expect(skin).toContain('.console-skin-select-menu')
    expect(skin).toContain('.console-skin-table')
    expect(skin).toContain('@supports ((-webkit-backdrop-filter: blur(1px))')
    expect(skin).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps upstream class names as compatibility aliases at each caller', () => {
    expect(read('src/components/layout/AppLayout.vue')).toContain(
      'app-shell console-skin-shell'
    )
    expect(read('src/components/layout/AppHeader.vue')).toContain(
      'app-header-surface console-skin-header'
    )
    expect(read('src/components/layout/AppSidebar.vue')).toContain(
      'sidebar console-skin-sidebar'
    )
    expect(read('src/components/common/BaseDialog.vue')).toContain(
      "'base-dialog-surface', 'console-skin-dialog'"
    )
    expect(read('src/components/common/Select.vue')).toContain(
      "'select-trigger',\n        'console-skin-select-trigger'"
    )
    expect(read('src/components/common/Select.vue')).toContain(
      'select-dropdown-portal console-skin-select-menu'
    )
    expect(read('src/components/layout/TablePageLayout.vue')).toContain(
      'frosted-table-shell console-skin-table'
    )
  })

  it('loads the skin after Tailwind component defaults so its surface contract wins', () => {
    const main = read('src/main.ts')
    const baseStyles = main.indexOf("import './style.css'")
    const skinStyles = main.indexOf("import './styles/console-skin.css'")

    expect(baseStyles).toBeGreaterThanOrEqual(0)
    expect(skinStyles).toBeGreaterThan(baseStyles)
    expect(read('src/style.css')).not.toContain("@import './styles/console-skin.css';")
  })

  it('animates console content without hiding the entire route shell', () => {
    const app = read('src/App.vue')
    const layout = read('src/components/layout/AppLayout.vue')

    expect(app).not.toContain('console-route-enter-from')
    expect(layout).toContain('console-route-content')
    expect(layout).toContain('@media (prefers-reduced-motion: reduce)')
  })
})
