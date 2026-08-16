import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import Threads from './Threads'

const ogl = vi.hoisted(() => ({
  shouldThrow: false,
  render: vi.fn(),
  loseContext: vi.fn(),
  renderers: [] as Array<{ dpr: number; setSize: ReturnType<typeof vi.fn> }>,
  programs: [] as Array<{ uniforms: Record<string, { value: any }> }>,
}))

vi.mock('ogl', () => {
  class Color {
    set = vi.fn()
  }

  class Renderer {
    dpr = 1
    gl: {
      canvas: HTMLCanvasElement
      BLEND: number
      ONE: number
      SRC_ALPHA: number
      ONE_MINUS_SRC_ALPHA: number
      clearColor: ReturnType<typeof vi.fn>
      enable: ReturnType<typeof vi.fn>
      blendFunc: ReturnType<typeof vi.fn>
      getExtension: ReturnType<typeof vi.fn>
    }
    setSize: ReturnType<typeof vi.fn>

    constructor() {
      if (ogl.shouldThrow) throw new Error('WebGL unavailable')
      const canvas = document.createElement('canvas')
      this.gl = {
        canvas,
        BLEND: 1,
        ONE: 2,
        SRC_ALPHA: 3,
        ONE_MINUS_SRC_ALPHA: 4,
        clearColor: vi.fn(),
        enable: vi.fn(),
        blendFunc: vi.fn(),
        getExtension: vi.fn((name: string) =>
          name === 'WEBGL_lose_context' ? { loseContext: ogl.loseContext } : null,
        ),
      }
      this.setSize = vi.fn((width: number, height: number) => {
        canvas.width = width
        canvas.height = height
      })
      ogl.renderers.push(this)
    }

    render(scene: unknown) {
      ogl.render(scene)
    }
  }

  class Program {
    uniforms: Record<string, { value: any }>

    constructor(_gl: unknown, options: { uniforms: Record<string, { value: any }> }) {
      this.uniforms = options.uniforms
      ogl.programs.push(this)
    }
  }

  return { Color, Mesh: class {}, Program, Renderer, Triangle: class {} }
})

interface MediaRecord {
  query: string
  listeners: Set<(event: MediaQueryListEvent) => void>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

interface ObserverRecord {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

let reducedMotion = false
let finePointer = true
let mobile = false
let nextFrameId = 0
let frameCallbacks = new Map<number, FrameRequestCallback>()
let requestFrame: ReturnType<typeof vi.fn>
let cancelFrame: ReturnType<typeof vi.fn>
let mediaRecords: MediaRecord[] = []
let resizeObservers: ObserverRecord[] = []
let intersectionObservers: ObserverRecord[] = []

function mediaMatches(query: string): boolean {
  if (query === '(prefers-reduced-motion: reduce)') return reducedMotion
  if (query === '(pointer: fine)') return finePointer
  if (query === '(max-width: 767px)') return mobile
  return false
}

function runNextFrame(time: number): boolean {
  const next = frameCallbacks.entries().next()
  if (next.done) return false
  const [id, callback] = next.value
  frameCallbacks.delete(id)
  callback(time)
  return true
}

describe('Threads', () => {
  beforeEach(() => {
    ogl.shouldThrow = false
    ogl.render.mockClear()
    ogl.loseContext.mockClear()
    ogl.renderers.length = 0
    ogl.programs.length = 0
    reducedMotion = false
    finePointer = true
    mobile = false
    nextFrameId = 0
    frameCallbacks = new Map()
    mediaRecords = []
    resizeObservers = []
    intersectionObservers = []

    requestFrame = vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrameId
      frameCallbacks.set(id, callback)
      return id
    })
    cancelFrame = vi.fn((id: number) => {
      frameCallbacks.delete(id)
    })

    vi.stubGlobal('requestAnimationFrame', requestFrame)
    vi.stubGlobal('cancelAnimationFrame', cancelFrame)
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => {
        const listeners = new Set<(event: MediaQueryListEvent) => void>()
        const record: MediaRecord = {
          query,
          listeners,
          addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
            listeners.add(listener)
          }),
          removeEventListener: vi.fn(
            (_type: string, listener: (event: MediaQueryListEvent) => void) => {
              listeners.delete(listener)
            },
          ),
        }
        mediaRecords.push(record)
        return {
          matches: mediaMatches(query),
          media: query,
          onchange: null,
          addEventListener: record.addEventListener,
          removeEventListener: record.removeEventListener,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(() => true),
        }
      }),
    )

    class MockResizeObserver {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(_callback: ResizeObserverCallback) {
        resizeObservers.push(this)
      }
    }
    class MockIntersectionObserver {
      observe = vi.fn()
      disconnect = vi.fn()

      constructor(_callback: IntersectionObserverCallback) {
        intersectionObservers.push(this)
      }
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps the decorative layer inert when WebGL initialization fails', () => {
    ogl.shouldThrow = true
    const { container } = render(<Threads />)

    expect(container.querySelector('.threads')?.getAttribute('data-webgl')).toBe('unavailable')
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('draws a static band without starting an animation loop', () => {
    const { container } = render(<Threads mode="static" className="test-band" />)
    const layer = container.querySelector('.threads')

    expect(layer?.classList.contains('threads--static')).toBe(true)
    expect(layer?.classList.contains('test-band')).toBe(true)
    expect(layer?.getAttribute('data-webgl')).toBe('ready')
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(ogl.render).toHaveBeenCalled()
    expect(requestFrame).not.toHaveBeenCalled()
    const program = ogl.programs[ogl.programs.length - 1]
    expect(program?.uniforms.iTime?.value).toBe(0)
  })

  it('honors reduced motion by rendering a still frame and scheduling no RAF', () => {
    reducedMotion = true
    render(<Threads mode="animated" />)

    expect(ogl.render).toHaveBeenCalled()
    expect(requestFrame).not.toHaveBeenCalled()
    const program = ogl.programs[ogl.programs.length - 1]
    expect(program?.uniforms.iTime?.value).toBe(0)
  })

  it('stops animation and exposes the fallback state when the WebGL context is lost', () => {
    const { container } = render(<Threads />)
    const layer = container.querySelector<HTMLElement>('.threads')!
    const canvas = container.querySelector('canvas')!
    expect(requestFrame).toHaveBeenCalledTimes(1)

    const event = new Event('webglcontextlost', { cancelable: true })
    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(layer.dataset.webgl).toBe('unavailable')
    expect(cancelFrame).toHaveBeenCalled()
    expect(frameCallbacks.size).toBe(0)
  })

  it('keeps persistent backgrounds out of intersection tracking and cleans window pointers', () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener')
    const removeWindowListener = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Threads persistent className="threads-page-background" />)

    expect(intersectionObservers).toHaveLength(0)
    expect(requestFrame).toHaveBeenCalledTimes(1)

    const pointerMoveCall = addWindowListener.mock.calls.find(([type]) => type === 'pointermove')
    const pointerLeaveCall = addWindowListener.mock.calls.find(([type]) => type === 'pointerleave')
    expect(pointerMoveCall).toBeDefined()
    expect(pointerLeaveCall).toBeDefined()

    unmount()

    expect(removeWindowListener).toHaveBeenCalledWith('pointermove', pointerMoveCall?.[1])
    expect(removeWindowListener).toHaveBeenCalledWith('pointerleave', pointerLeaveCall?.[1])
    expect(frameCallbacks.size).toBe(0)
  })

  it('tracks the page pointer with the original centered smoothing and resets on blur', () => {
    const { container } = render(<Threads persistent enableMouseInteraction />)
    const layer = container.querySelector<HTMLElement>('.threads')!
    vi.spyOn(layer, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 400,
      width: 800,
      height: 400,
      toJSON: () => ({}),
    } as DOMRect)

    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 800, clientY: 0 }))
    expect(runNextFrame(17)).toBe(true)
    const mouse = ogl.programs[0]?.uniforms.uMouse?.value as Float32Array
    expect(mouse[0]).toBeCloseTo(0.525, 3)
    expect(mouse[1]).toBeCloseTo(0.525, 3)
    expect(ogl.programs[0]?.uniforms.uAmplitude?.value).toBe(1)
    expect(ogl.programs[0]?.uniforms.uDistance?.value).toBe(0)

    window.dispatchEvent(new Event('blur'))
    expect(runNextFrame(34)).toBe(true)
    expect(mouse[0]).toBeLessThan(0.525)
    expect(mouse[1]).toBeLessThan(0.525)
  })

  it('removes observers, the canvas, listeners, and the WebGL context on cleanup', () => {
    const { container, unmount } = render(<Threads />)
    expect(container.querySelectorAll('canvas')).toHaveLength(1)

    unmount()

    expect(container.querySelector('canvas')).toBeNull()
    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledTimes(1)
    expect(intersectionObservers[0]?.disconnect).toHaveBeenCalledTimes(1)
    expect(ogl.loseContext).toHaveBeenCalledTimes(1)
    expect(cancelFrame).toHaveBeenCalledTimes(1)
    const motionRecord = mediaRecords.find(
      (record) => record.query === '(prefers-reduced-motion: reduce)',
    )
    expect(motionRecord?.removeEventListener).toHaveBeenCalledTimes(1)
  })

  it('leaves one canvas and one active lifecycle under React StrictMode', () => {
    const { container, unmount } = render(
      <StrictMode>
        <Threads />
      </StrictMode>,
    )

    expect(ogl.renderers).toHaveLength(2)
    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(ogl.loseContext).toHaveBeenCalledTimes(1)

    unmount()
    expect(container.querySelectorAll('canvas')).toHaveLength(0)
    expect(ogl.loseContext).toHaveBeenCalledTimes(2)
  })

  it('uses DPR 1 and limits mobile rendering to approximately 30fps', () => {
    mobile = true
    finePointer = false
    render(<Threads />)
    const renderer = ogl.renderers[0]
    const initialRenderCount = ogl.render.mock.calls.length

    expect(renderer?.dpr).toBe(1)
    expect(runNextFrame(0)).toBe(true)
    expect(runNextFrame(10)).toBe(true)
    expect(runNextFrame(34)).toBe(true)
    expect(ogl.render).toHaveBeenCalledTimes(initialRenderCount + 2)
  })

  it('caps desktop rendering at approximately 60fps', () => {
    render(<Threads />)
    const initialRenderCount = ogl.render.mock.calls.length

    expect(runNextFrame(0)).toBe(true)
    expect(runNextFrame(8)).toBe(true)
    expect(runNextFrame(17)).toBe(true)
    expect(ogl.render).toHaveBeenCalledTimes(initialRenderCount + 2)
  })

  it('updates DPR and frame policy when crossing the mobile breakpoint', () => {
    render(<Threads />)
    const renderer = ogl.renderers[0]
    const mobileRecord = mediaRecords.find((record) => record.query === '(max-width: 767px)')

    expect(renderer?.dpr).toBe(1.5)
    mobileRecord?.listeners.forEach((listener) => {
      listener({ matches: true } as MediaQueryListEvent)
    })

    expect(renderer?.dpr).toBe(1)
    expect(renderer?.setSize).toHaveBeenCalledTimes(2)
  })
})
