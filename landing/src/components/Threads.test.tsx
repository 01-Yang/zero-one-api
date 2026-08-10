import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import Threads from './Threads'

vi.mock('ogl', () => ({
  Color: class {},
  Mesh: class {},
  Program: class {},
  Renderer: class {
    constructor() {
      throw new Error('WebGL unavailable')
    }
  },
  Triangle: class {},
}))

describe('Threads', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  afterEach(cleanup)

  it('keeps the decorative layer inert when WebGL initialization fails', async () => {
    const { container } = render(<Threads />)

    await waitFor(() => {
      expect(container.querySelector('.threads')?.getAttribute('data-webgl')).toBe('unavailable')
    })
    expect(container.querySelector('canvas')).toBeNull()
  })
})
