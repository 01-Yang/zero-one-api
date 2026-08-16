import { describe, expect, it } from 'vitest'

import config from '../../../tailwind.config.js'
import { consolePalette } from '../palette-adapter.js'

describe('Console palette adapter', () => {
  it('exposes explicit Zero One roles with compatibility aliases', () => {
    const colors = config.theme.extend.colors

    expect(colors.primary).toBe(consolePalette.primary)
    expect(colors.accent).toBe(consolePalette.accent)
    expect(colors['zo-signal']).toBe(consolePalette.signal)
    expect(colors['zo-alert']).toBe(consolePalette.alert)
  })

  it('does not redefine Tailwind semantic color families', () => {
    const colors = config.theme.extend.colors

    expect(colors.green).toBeUndefined()
    expect(colors.emerald).toBeUndefined()
    expect(colors.teal).toBeUndefined()
    expect(colors.amber).toBeUndefined()
    expect(colors.orange).toBeUndefined()
    expect(colors.yellow).toBeUndefined()
  })
})
