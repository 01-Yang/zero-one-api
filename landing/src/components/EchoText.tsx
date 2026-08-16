import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const directionVectors = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  diagonal: { x: 0.72, y: 0.72 },
} as const

const easing = {
  linear: (value: number) => value,
  'ease-out': (value: number) => 1 - Math.pow(1 - value, 3),
  'ease-in-out': (value: number) =>
    value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2,
  snappy: (value: number) => 1 - Math.pow(1 - value, 5),
} as const

type EchoDirection = keyof typeof directionVectors
type EchoEase = keyof typeof easing
type EchoMode = 'entrance' | 'pointer' | 'both'

interface EchoPosition {
  x: number
  y: number
}

interface EchoState {
  targetX: number
  targetY: number
  lastTargetX: number
  lastTargetY: number
  activity: number
  positions: EchoPosition[]
  startTime: number
}

export interface EchoTextProps {
  text: string
  echoes?: number
  lag?: number
  offset?: number
  direction?: EchoDirection
  fade?: number
  blur?: number
  tint?: string
  mode?: EchoMode
  cursorRadius?: number
  duration?: number
  ease?: EchoEase
  fontSize?: CSSProperties['fontSize']
  fontWeight?: CSSProperties['fontWeight']
  color?: CSSProperties['color']
  className?: string
  style?: CSSProperties
  interactionTargetRef?: RefObject<HTMLElement | null>
}

const reducedMotionQuery = '(prefers-reduced-motion: reduce)'
const finePointerQuery = '(hover: hover) and (pointer: fine)'

const motionPreference = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(reducedMotionQuery).matches
    : false

/**
 * A DOM-based text echo. The front text remains accessible while the trailing
 * copies are visual-only, allowing a readable static fallback without Canvas.
 */
export default function EchoText({
  text,
  echoes = 12,
  lag = 0.24,
  offset = 36,
  direction = 'right',
  fade = 0.72,
  blur = 3,
  tint = '#a6a6ad',
  mode = 'both',
  cursorRadius = 320,
  duration = 900,
  ease = 'ease-out',
  fontSize = 'clamp(3rem, 9vw, 6rem)',
  fontWeight = 800,
  color = '#f8fafc',
  className = '',
  style,
  interactionTargetRef,
}: EchoTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const copyRefs = useRef<Array<HTMLSpanElement | null>>([])
  const frameRef = useRef<number | null>(null)
  const stateRef = useRef<EchoState | null>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(motionPreference)

  const echoCount = prefersReducedMotion ? 0 : clamp(Math.round(echoes), 0, 24)
  const copyIndexes = useMemo(
    () => Array.from({ length: echoCount + 1 }, (_, index) => index),
    [echoCount],
  )
  const safeOffset = clamp(Number(offset) || 0, 0, 120)
  const vector = directionVectors[direction]
  const entranceEnabled = mode === 'entrance' || mode === 'both'

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const media = window.matchMedia(reducedMotionQuery)
    const syncPreference = () => setPrefersReducedMotion(media.matches)
    syncPreference()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncPreference)
      return () => media.removeEventListener('change', syncPreference)
    }

    media.addListener(syncPreference)
    return () => media.removeListener(syncPreference)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion) return

    const safeCursorRadius = clamp(Number(cursorRadius) || 320, 40, 1200)
    const safeLag = clamp(Number(lag) || 0.16, 0.02, 0.5)
    const safeFade = clamp(Number(fade) || 0.64, 0.1, 0.95)
    const safeBlur = clamp(Number(blur) || 0, 0, 16)
    const safeDuration = Math.max(0, Number(duration) || 0)
    const easeFn = easing[ease]
    const pointerEnabled = mode === 'pointer' || mode === 'both'
    const hoverQuery = window.matchMedia?.(finePointerQuery)
    const canHover = Boolean(pointerEnabled && hoverQuery?.matches)
    const interactionTarget = interactionTargetRef?.current ?? root
    const state: EchoState = {
      targetX: 0,
      targetY: 0,
      lastTargetX: 0,
      lastTargetY: 0,
      activity: entranceEnabled ? 1 : 0,
      positions: Array.from({ length: echoCount + 1 }, (_, index) => {
        const amount = entranceEnabled ? safeOffset * (index + 0.35) : 0
        return { x: vector.x * amount, y: vector.y * amount }
      }),
      startTime: performance.now(),
    }
    stateRef.current = state

    const stopAnimation = () => {
      if (frameRef.current === null) return
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    const renderFrame = (now: number) => {
      const currentState = stateRef.current
      if (!currentState) {
        frameRef.current = null
        return
      }

      const elapsed = now - currentState.startTime
      const entranceProgress =
        entranceEnabled && safeDuration > 0 ? clamp(elapsed / safeDuration, 0, 1) : 1
      const entranceRest = entranceEnabled ? 1 - easeFn(entranceProgress) : 0
      const targetVelocity = Math.hypot(
        currentState.targetX - currentState.lastTargetX,
        currentState.targetY - currentState.lastTargetY,
      )
      currentState.lastTargetX = currentState.targetX
      currentState.lastTargetY = currentState.targetY

      let maxSeparation = 0
      let maxRemainingDistance = 0

      for (let index = 0; index <= echoCount; index += 1) {
        const copy = copyRefs.current[index]
        const position = currentState.positions[index]
        if (!copy || !position) continue

        const entranceAmount = entranceRest * safeOffset * (index + 0.35)
        const desiredX = currentState.targetX + vector.x * entranceAmount
        const desiredY = currentState.targetY + vector.y * entranceAmount
        const follow = clamp(0.34 / (1 + index * safeLag * 4.2), 0.018, 0.36)

        position.x += (desiredX - position.x) * follow
        position.y += (desiredY - position.y) * follow
        maxRemainingDistance = Math.max(
          maxRemainingDistance,
          Math.hypot(desiredX - position.x, desiredY - position.y),
        )
        copy.style.transform = `translate3d(${position.x.toFixed(3)}px, ${position.y.toFixed(3)}px, 0)`

        if (index > 0) {
          const front = currentState.positions[0]
          const separation = front ? Math.hypot(position.x - front.x, position.y - front.y) : 0
          maxSeparation = Math.max(maxSeparation, separation)
          const depth = echoCount ? index / echoCount : 0
          copy.style.filter = safeBlur > 0 ? `blur(${(safeBlur * depth).toFixed(2)}px)` : 'none'
          copy.style.opacity = String(Math.pow(safeFade, index) * currentState.activity)
        }
      }

      const separationActivity = safeOffset > 0 ? clamp(maxSeparation / (safeOffset * 2.25), 0, 1) : 0
      const targetActivity = safeOffset > 0 ? clamp(targetVelocity / (safeOffset * 0.35), 0, 1) : 0
      const nextActivity = Math.max(entranceRest, separationActivity, targetActivity)
      currentState.activity += (nextActivity - currentState.activity) * 0.18

      const stillMoving =
        entranceProgress < 1 ||
        currentState.activity > 0.002 ||
        maxRemainingDistance > 0.01

      if (stillMoving) {
        frameRef.current = window.requestAnimationFrame(renderFrame)
      } else {
        frameRef.current = null
      }
    }

    const startAnimation = () => {
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(renderFrame)
    }

    const handlePointerMove = (event: PointerEvent) => {
      const currentState = stateRef.current
      if (!currentState) return

      const rect = root.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      const deltaX = event.clientX - (rect.left + rect.width / 2)
      const deltaY = event.clientY - (rect.top + rect.height / 2)
      const distance = Math.hypot(deltaX, deltaY)
      const reach = distance > 0 ? clamp(distance / safeCursorRadius, 0, 1) : 0
      const directionX = distance > 0 ? deltaX / distance : 0
      const directionY = distance > 0 ? deltaY / distance : 0

      currentState.targetX = directionX * reach * safeOffset
      currentState.targetY = directionY * reach * safeOffset * 0.72
      startAnimation()
    }

    const handlePointerLeave = () => {
      const currentState = stateRef.current
      if (!currentState) return
      currentState.targetX = 0
      currentState.targetY = 0
      startAnimation()
    }

    if (canHover) {
      interactionTarget.addEventListener('pointermove', handlePointerMove, { passive: true })
      interactionTarget.addEventListener('pointerleave', handlePointerLeave)
    }

    if (entranceEnabled || canHover) startAnimation()

    return () => {
      if (canHover) {
        interactionTarget.removeEventListener('pointermove', handlePointerMove)
        interactionTarget.removeEventListener('pointerleave', handlePointerLeave)
      }
      stopAnimation()
      stateRef.current = null
    }
  }, [
    blur,
    cursorRadius,
    direction,
    duration,
    ease,
    echoCount,
    fade,
    interactionTargetRef,
    lag,
    mode,
    offset,
    prefersReducedMotion,
  ])

  const rootStyle: CSSProperties = {
    color,
    fontSize,
    fontWeight,
    ...style,
  }

  return (
    <span ref={rootRef} className={`echo-text ${className}`.trim()} style={rootStyle} data-echo-text>
      {copyIndexes
        .slice(1)
        .reverse()
        .map((index) => {
          const initialAmount = entranceEnabled ? safeOffset * (index + 0.35) : 0
          return (
            <span
              aria-hidden="true"
              className="echo-text__echo"
              data-echo-index={index}
              key={`echo-${index}`}
              ref={(element) => {
                copyRefs.current[index] = element
              }}
              style={{
                color: `color-mix(in srgb, ${tint} ${Math.min(72, 18 + index * 5)}%, ${color})`,
                opacity: 0,
                transform: `translate3d(${(vector.x * initialAmount).toFixed(3)}px, ${(vector.y * initialAmount).toFixed(3)}px, 0)`,
              }}
            >
              {text}
            </span>
          )
        })}
      <span
        className="echo-text__echo echo-text__echo--front"
        data-echo-index="0"
        ref={(element) => {
          copyRefs.current[0] = element
        }}
        style={{
          transform: `translate3d(${(vector.x * (entranceEnabled ? safeOffset * 0.35 : 0)).toFixed(3)}px, ${(vector.y * (entranceEnabled ? safeOffset * 0.35 : 0)).toFixed(3)}px, 0)`,
        }}
      >
        {text}
      </span>
    </span>
  )
}
