import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const versionBadgePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../common/VersionBadge.vue'
)
const versionBadgeSource = readFileSync(versionBadgePath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar scroll position persistence', () => {
  it('binds a template ref to the sidebar nav element', () => {
    expect(componentSource).toContain('ref="sidebarNavRef"')
    expect(componentSource).toContain('sidebar-nav')
  })

  it('declares sidebarNavRef in script setup', () => {
    expect(componentSource).toContain("const sidebarNavRef = ref<HTMLElement | null>(null)")
  })

  it('saves scroll position on beforeUnmount', () => {
    expect(componentSource).toContain('onBeforeUnmount')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('sidebarNavRef.value.scrollTop')
  })

  it('restores scroll position on mount', () => {
    expect(componentSource).toContain('onMounted')
    expect(componentSource).toContain('appStore.sidebarScrollTop')
    expect(componentSource).toContain('nextTick')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})

describe('AppSidebar managed release updates', () => {
  it('marks the branded Docker release as externally managed', () => {
    expect(componentSource).toContain('<VersionBadge managed :version="siteVersion" />')
    expect(versionBadgeSource).toContain('managed?: boolean')
    expect(versionBadgeSource).toContain('const isManagedRelease = computed(() => props.managed === true)')
  })

  it('shows managed guidance before the in-place release updater', () => {
    const managedBranch = versionBadgeSource.indexOf(
      'v-else-if="hasUpdate && isManagedRelease"'
    )
    const inPlaceBranch = versionBadgeSource.indexOf(
      'v-else-if="hasUpdate && isReleaseBuild"'
    )

    expect(managedBranch).toBeGreaterThan(-1)
    expect(inPlaceBranch).toBeGreaterThan(managedBranch)
    expect(versionBadgeSource).toContain("t('version.managedUpdateHint')")
    expect(versionBadgeSource).toContain("t('version.managedRollbackHint')")
  })
})
