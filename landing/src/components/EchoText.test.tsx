import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import EchoText from './EchoText'

interface MediaRecord {
  query: string
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
}

const rect = () =>
  ({
    bottom: 120,
    height: 120,
    left: 0,
    right: 600,
    toJSON: () => ({}),
    top: 0,
    width: 600,
    x: 0,
    y: 0,
  }) as DOMRect

describe('EchoText', () => {
  let reducedMotion = false
  let finePointer = true
  let nextFrameId = 0
  let frameCallbacks = new Map<number, FrameRequestCallback>()
  let requestFrame: ReturnType<typeof vi.fn>
  let cancelFrame: ReturnType<typeof vi.fn>
  let mediaRecords: MediaRecord[]

  beforeEach(() => {
    reducedMotion = false
    finePointer = true
    nextFrameId = 0
    frameCallbacks = new Map()
    mediaRecords = []
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
        const record: MediaRecord = {
          query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
        mediaRecords.push(record)
        return {
          matches:
            query === '(prefers-reduced-motion: reduce)' ? reducedMotion : finePointer,
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
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rect)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps one readable front copy and marks trailing copies decorative', () => {
    const { container } = render(<EchoText text="零一 API" echoes={3} />)

    const root = container.querySelector<HTMLElement>('[data-echo-text]')
    const copies = container.querySelectorAll<HTMLElement>('.echo-text__echo')
    expect(root).not.toBeNull()
    expect(copies).toHaveLength(4)
    expect(copies[0]?.getAttribute('aria-hidden')).toBe('true')
    expect(copies[3]?.classList.contains('echo-text__echo--front')).toBe(true)
    expect(copies[3]?.getAttribute('aria-hidden')).toBeNull()
    expect(copies[3]?.textContent).toBe('零一 API')
  })

  it('uses only the readable front copy and schedules no animation for reduced motion', () => {
    reducedMotion = true
    const { container, getByText } = render(<EchoText text="从零到一，连接每一次模型调用" />)

    expect(getByText('从零到一，连接每一次模型调用')).not.toBeNull()
    expect(container.querySelectorAll('.echo-text__echo')).toHaveLength(1)
    expect(requestFrame).not.toHaveBeenCalled()
  })

  it('moves decorative copies when a fine pointer moves over the text', () => {
    const { container } = render(<EchoText text="零一 API" echoes={2} duration={0} />)
    const root = container.querySelector<HTMLElement>('[data-echo-text]')!
    const copies = container.querySelectorAll<HTMLElement>('.echo-text__echo')

    fireEvent.pointerMove(root, { clientX: 580, clientY: 60 })
    const [frameId, frame] = frameCallbacks.entries().next().value as [number, FrameRequestCallback]
    frameCallbacks.delete(frameId)
    frame(1000)

    expect(copies[0]?.style.transform).not.toBe(copies[2]?.style.transform)
    expect(copies[0]?.style.opacity).not.toBe(copies[2]?.style.opacity)
  })

  it('stops scheduling frames after a stationary pointer trail settles', () => {
    const { container } = render(<EchoText text="零一 API" echoes={2} duration={0} />)
    const root = container.querySelector<HTMLElement>('[data-echo-text]')!

    fireEvent.pointerMove(root, { clientX: 580, clientY: 60 })

    for (let time = 16; time < 2400 && frameCallbacks.size; time += 16) {
      const pendingFrames = [...frameCallbacks.entries()]
      frameCallbacks.clear()
      pendingFrames.forEach(([, callback]) => callback(time))
    }

    expect(frameCallbacks.size).toBe(0)
  })

  it('cleans the active animation and motion preference listener in Strict Mode', () => {
    const { unmount } = render(
      <StrictMode>
        <EchoText text="零一 API" />
      </StrictMode>,
    )

    unmount()

    expect(cancelFrame).toHaveBeenCalled()
    expect(
      mediaRecords
        .filter(
          (record) =>
            record.query === '(prefers-reduced-motion: reduce)' &&
            record.addEventListener.mock.calls.length > 0,
        )
        .every((record) => record.removeEventListener.mock.calls.length === 1),
    ).toBe(true)
  })
})
