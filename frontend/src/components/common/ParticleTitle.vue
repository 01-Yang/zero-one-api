<template>
  <component
    :is="as"
    ref="containerRef"
    class="particle-title"
    :class="{ 'particle-title--canvas-ready': rendererState === 'ready' }"
    :data-particle-renderer="rendererState"
  >
    <!-- This remains visible whenever Canvas is unavailable or motion is reduced. -->
    <span ref="fallbackRef" class="particle-title__fallback" aria-hidden="true">{{ text }}</span>
    <canvas ref="canvasRef" class="particle-title__canvas" aria-hidden="true" />
    <span class="particle-title__sr">{{ text }}</span>
  </component>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type TitleElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div' | 'span'
type RendererState = 'loading' | 'ready' | 'fallback' | 'reduced'

interface Props {
  text: string
  as?: TitleElement
  color?: string
  highlightColor?: string
  particleSize?: number
  density?: number
  scatter?: number
  gatherDuration?: number
  stagger?: number
  pointerRepel?: number
  repelRadius?: number
  maxParticles?: number
  glow?: boolean
}

interface Particle {
  x: number
  y: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  size: number
  color: string
  seed: number
  depth: number
  delay: number
}

interface RgbColor {
  r: number
  g: number
  b: number
}

const props = withDefaults(defineProps<Props>(), {
  as: 'h2',
  particleSize: 1.7,
  density: 3,
  scatter: 96,
  gatherDuration: 1000,
  stagger: 220,
  pointerRepel: 24,
  repelRadius: 84,
  maxParticles: 1600,
  glow: true
})

const containerRef = ref<HTMLElement | null>(null)
const fallbackRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const rendererState = ref<RendererState>('loading')

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3)
const seedFor = (index: number) => ((index * 9301 + 49297) % 233280) / 233280

const parseColor = (value: string): RgbColor | null => {
  const color = value.trim()
  const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]

  if (hex) {
    const normalized = hex.length === 3 ? [...hex].map((part) => `${part}${part}`).join('') : hex
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16)
    }
  }

  const rgb = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i)
  return rgb
    ? {
        r: clamp(Math.round(Number(rgb[1])), 0, 255),
        g: clamp(Math.round(Number(rgb[2])), 0, 255),
        b: clamp(Math.round(Number(rgb[3])), 0, 255)
      }
    : null
}

const mixColor = (from: RgbColor, to: RgbColor, amount: number) =>
  `rgb(${Math.round(from.r + (to.r - from.r) * amount)}, ${Math.round(
    from.g + (to.g - from.g) * amount
  )}, ${Math.round(from.b + (to.b - from.b) * amount)})`

let queueRebuild: (() => void) | null = null
let disposeRenderer: (() => void) | null = null

onMounted(() => {
  const container = containerRef.value
  const fallback = fallbackRef.value
  const canvas = canvasRef.value
  if (!container || !fallback || !canvas) return

  // JSDOM and other non-rendering environments expose a canvas element without
  // a 2D context. Preserve the readable DOM title without triggering a noisy
  // unsupported-canvas call in those environments.
  if (typeof CanvasRenderingContext2D === 'undefined') {
    rendererState.value = 'fallback'
    return
  }

  let context: CanvasRenderingContext2D | null = null
  try {
    context = canvas.getContext('2d')
  } catch {
    context = null
  }
  if (!context) {
    rendererState.value = 'fallback'
    return
  }

  const ctx = context
  const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const compactQuery = window.matchMedia?.('(max-width: 767px)')
  const finePointerQuery = window.matchMedia?.('(any-pointer: fine)')
  let reducedMotion = reducedMotionQuery?.matches ?? false
  let compactViewport = compactQuery?.matches ?? false
  let hasFinePointer = finePointerQuery?.matches ?? true
  let particles: Particle[] = []
  let width = 0
  let height = 0
  let frameId: number | null = null
  let resizeFrameId: number | null = null
  let gatherStart = 0
  let gathering = false
  let interactionUntil = 0
  let buildVersion = 0
  let disposed = false
  let visible = !document.hidden
  let onscreen = true
  let resizeObserver: ResizeObserver | null = null
  let intersectionObserver: IntersectionObserver | null = null

  const pointer = { active: false, x: 0, y: 0, smoothX: 0, smoothY: 0 }

  const stopFrame = () => {
    if (frameId !== null) window.cancelAnimationFrame(frameId)
    frameId = null
  }

  const render = (now: number) => {
    ctx.clearRect(0, 0, width, height)
    pointer.smoothX += (pointer.x - pointer.smoothX) * 0.22
    pointer.smoothY += (pointer.y - pointer.smoothY) * 0.22

    if (props.glow && !compactViewport) {
      ctx.shadowBlur = props.particleSize * 2.6
      ctx.shadowColor = props.highlightColor || getComputedStyle(container).getPropertyValue('--particle-title-highlight')
    }

    let gathered = true
    for (const particle of particles) {
      let targetX = particle.targetX
      let targetY = particle.targetY
      let progress = 1

      if (gathering) {
        progress = clamp((now - gatherStart - particle.delay) / Math.max(1, props.gatherDuration), 0, 1)
        const eased = easeOutCubic(progress)
        targetX = particle.startX + (particle.targetX - particle.startX) * eased
        targetY = particle.startY + (particle.targetY - particle.startY) * eased
        if (progress < 1) gathered = false
      }

      if (pointer.active && hasFinePointer) {
        const deltaX = targetX - pointer.smoothX
        const deltaY = targetY - pointer.smoothY
        const distance = Math.hypot(deltaX, deltaY)
        if (distance > 0 && distance < props.repelRadius) {
          const force = Math.pow(1 - distance / props.repelRadius, 2) * props.pointerRepel
          targetX += (deltaX / distance) * force
          targetY += (deltaY / distance) * force
        }
      }

      particle.x += (targetX - particle.x) * 0.32
      particle.y += (targetY - particle.y) * 0.32
      ctx.globalAlpha = 0.38 + progress * 0.62
      ctx.fillStyle = particle.color

      if (particle.size <= 2) {
        ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size)
      } else {
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    if (gathering && gathered) {
      gathering = false
      interactionUntil = Math.max(interactionUntil, now + 160)
    }
  }

  const runFrame = (now: number) => {
    frameId = null
    if (disposed || reducedMotion || !visible || !onscreen) return

    render(now)
    if (gathering || now < interactionUntil) frameId = window.requestAnimationFrame(runFrame)
  }

  const requestRender = () => {
    if (!disposed && !reducedMotion && visible && onscreen && frameId === null) {
      frameId = window.requestAnimationFrame(runFrame)
    }
  }

  const waitForFont = async (font: string) => {
    if (!document.fonts) return
    try {
      await document.fonts.load(font, props.text)
      await document.fonts.ready
    } catch {
      // A system fallback font can still be sampled safely.
    }
  }

  const buildParticles = async () => {
    const currentBuild = ++buildVersion
    stopFrame()
    particles = []

    if (reducedMotion) {
      rendererState.value = 'reduced'
      return
    }

    rendererState.value = 'loading'
    const containerRect = container.getBoundingClientRect()
    const fallbackRect = fallback.getBoundingClientRect()
    width = Math.floor(containerRect.width)
    height = Math.floor(containerRect.height)
    if (width <= 0 || height <= 0 || fallbackRect.width <= 0 || fallbackRect.height <= 0) {
      rendererState.value = 'fallback'
      return
    }

    const style = window.getComputedStyle(fallback)
    const font = style.font || `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    await waitForFont(font)
    if (disposed || currentBuild !== buildVersion) return

    const dpr = Math.min(window.devicePixelRatio || 1, compactViewport ? 1 : 1.5)
    canvas.width = Math.max(1, Math.floor(width * dpr))
    canvas.height = Math.max(1, Math.floor(height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const offscreenContext = offscreen.getContext('2d', { willReadFrequently: true })
    if (!offscreenContext) {
      rendererState.value = 'fallback'
      return
    }

    offscreenContext.font = font
    const metrics = offscreenContext.measureText(props.text)
    const letterSpacing = style.letterSpacing === 'normal' ? 0 : Number.parseFloat(style.letterSpacing) || 0
    const glyphs = Array.from(props.text)
    const glyphWidths = glyphs.map((glyph) => offscreenContext.measureText(glyph).width)
    const textWidth =
      letterSpacing === 0
        ? metrics.width
        : glyphWidths.reduce((total, glyphWidth) => total + glyphWidth, 0) + letterSpacing * Math.max(0, glyphs.length - 1)

    // Keep wrapped or truncated titles as readable DOM text instead of drawing a misleading canvas copy.
    if (textWidth > fallbackRect.width + 2) {
      rendererState.value = 'fallback'
      return
    }

    const relativeLeft = fallbackRect.left - containerRect.left
    const relativeTop = fallbackRect.top - containerRect.top
    const alignment = style.textAlign
    const startX =
      alignment === 'right' || alignment === 'end'
        ? relativeLeft + fallbackRect.width - textWidth
        : alignment === 'center'
          ? relativeLeft + (fallbackRect.width - textWidth) / 2
          : relativeLeft
    const ascent = metrics.actualBoundingBoxAscent || Number.parseFloat(style.fontSize) * 0.78
    const descent = metrics.actualBoundingBoxDescent || Number.parseFloat(style.fontSize) * 0.22
    const baseline = relativeTop + (fallbackRect.height + ascent - descent) / 2

    offscreenContext.fillStyle = '#fff'
    offscreenContext.textAlign = 'left'
    offscreenContext.textBaseline = 'alphabetic'
    if (letterSpacing === 0) {
      offscreenContext.fillText(props.text, startX, baseline)
    } else {
      let cursor = startX
      glyphs.forEach((glyph, index) => {
        offscreenContext.fillText(glyph, cursor, baseline)
        cursor += glyphWidths[index]! + letterSpacing
      })
    }

    let imageData: ImageData
    try {
      imageData = offscreenContext.getImageData(0, 0, width, height)
    } catch {
      rendererState.value = 'fallback'
      return
    }

    const density = clamp(Math.floor(props.density), 2, 8)
    const targets: Array<{ x: number; y: number; alpha: number }> = []
    for (let y = Math.max(0, Math.floor(relativeTop)); y < Math.min(height, Math.ceil(relativeTop + fallbackRect.height)); y += density) {
      for (let x = Math.max(0, Math.floor(relativeLeft)); x < Math.min(width, Math.ceil(relativeLeft + fallbackRect.width)); x += density) {
        const alpha = imageData.data[(y * width + x) * 4 + 3] ?? 0
        if (alpha > 40) targets.push({ x, y, alpha: alpha / 255 })
      }
    }

    const areaLimit = clamp(Math.floor((width * height) / 100), 180, compactViewport ? 800 : 2200)
    const particleLimit = Math.min(props.maxParticles, areaLimit)
    const stride = Math.max(1, Math.ceil(targets.length / particleLimit))
    const baseColor = props.color || style.getPropertyValue('--particle-title-color').trim() || style.color
    const highlightColor = props.highlightColor || style.getPropertyValue('--particle-title-highlight').trim() || '#71717a'
    const baseRgb = parseColor(baseColor)
    const highlightRgb = parseColor(highlightColor)

    particles = targets.filter((_, index) => index % stride === 0).map((target, index) => {
      const seed = seedFor(index)
      const depth = 0.45 + seedFor(index + 173) * 0.9
      const angle = seed * Math.PI * 2
      const distance = props.scatter * (0.35 + depth * 0.75)
      const color =
        baseRgb && highlightRgb
          ? mixColor(baseRgb, highlightRgb, clamp(target.x / Math.max(1, width) + (seed - 0.5) * 0.35, 0, 1))
          : baseColor
      const targetX = target.x
      const targetY = target.y

      return {
        x: targetX + Math.cos(angle) * distance + (seed - 0.5) * props.scatter * 0.45,
        y: targetY + Math.sin(angle) * distance + (depth - 0.9) * props.scatter * 0.45,
        startX: targetX + Math.cos(angle) * distance + (seed - 0.5) * props.scatter * 0.45,
        startY: targetY + Math.sin(angle) * distance + (depth - 0.9) * props.scatter * 0.45,
        targetX,
        targetY,
        size: Math.max(0.6, props.particleSize * (0.75 + target.alpha * 0.45)),
        color,
        seed,
        depth,
        delay: seed * props.stagger
      }
    })

    if (particles.length === 0) {
      rendererState.value = 'fallback'
      return
    }

    pointer.x = width / 2
    pointer.y = height / 2
    pointer.smoothX = pointer.x
    pointer.smoothY = pointer.y
    gatherStart = performance.now()
    gathering = true
    interactionUntil = gatherStart + props.gatherDuration + props.stagger + 180
    render(gatherStart)
    rendererState.value = 'ready'
    requestRender()
  }

  const queueBuild = () => {
    if (resizeFrameId !== null) window.cancelAnimationFrame(resizeFrameId)
    resizeFrameId = window.requestAnimationFrame(() => {
      resizeFrameId = null
      void buildParticles()
    })
  }

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !hasFinePointer || reducedMotion) return
    const rect = container.getBoundingClientRect()
    pointer.x = event.clientX - rect.left
    pointer.y = event.clientY - rect.top
    pointer.active = true
    interactionUntil = performance.now() + 180
    requestRender()
  }
  const handlePointerLeave = () => {
    pointer.active = false
    interactionUntil = performance.now() + 220
    requestRender()
  }
  const handleVisibility = () => {
    visible = !document.hidden
    if (visible) requestRender()
    else stopFrame()
  }
  const handleMotionChange = (event: MediaQueryListEvent) => {
    reducedMotion = event.matches
    queueBuild()
  }
  const handleCompactChange = (event: MediaQueryListEvent) => {
    compactViewport = event.matches
    queueBuild()
  }
  const handlePointerCapabilityChange = (event: MediaQueryListEvent) => {
    hasFinePointer = event.matches
    if (!hasFinePointer) handlePointerLeave()
  }

  container.addEventListener('pointermove', handlePointerMove, { passive: true })
  container.addEventListener('pointerleave', handlePointerLeave, { passive: true })
  document.addEventListener('visibilitychange', handleVisibility)
  reducedMotionQuery?.addEventListener?.('change', handleMotionChange)
  compactQuery?.addEventListener?.('change', handleCompactChange)
  finePointerQuery?.addEventListener?.('change', handlePointerCapabilityChange)

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(queueBuild)
    resizeObserver.observe(container)
  } else {
    window.addEventListener('resize', queueBuild, { passive: true })
  }
  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver((entries) => {
      onscreen = entries[0]?.isIntersecting ?? true
      if (onscreen) requestRender()
      else stopFrame()
    })
    intersectionObserver.observe(container)
  }

  queueRebuild = queueBuild
  queueBuild()
  disposeRenderer = () => {
    disposed = true
    buildVersion += 1
    stopFrame()
    if (resizeFrameId !== null) window.cancelAnimationFrame(resizeFrameId)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    if (typeof ResizeObserver === 'undefined') window.removeEventListener('resize', queueBuild)
    container.removeEventListener('pointermove', handlePointerMove)
    container.removeEventListener('pointerleave', handlePointerLeave)
    document.removeEventListener('visibilitychange', handleVisibility)
    reducedMotionQuery?.removeEventListener?.('change', handleMotionChange)
    compactQuery?.removeEventListener?.('change', handleCompactChange)
    finePointerQuery?.removeEventListener?.('change', handlePointerCapabilityChange)
    canvas.width = 1
    canvas.height = 1
  }
})

watch(
  () => [
    props.text,
    props.color,
    props.highlightColor,
    props.particleSize,
    props.density,
    props.scatter,
    props.gatherDuration,
    props.stagger,
    props.pointerRepel,
    props.repelRadius,
    props.maxParticles,
    props.glow
  ],
  () => nextTick(() => queueRebuild?.())
)

onBeforeUnmount(() => {
  disposeRenderer?.()
  disposeRenderer = null
  queueRebuild = null
})
</script>

<style scoped>
.particle-title {
  --particle-title-color: #18181b;
  --particle-title-highlight: #71717a;
  isolation: isolate;
  position: relative;
}

:global(.dark) .particle-title {
  --particle-title-color: #fafafa;
  --particle-title-highlight: #a1a1aa;
}

.particle-title__fallback {
  color: var(--particle-title-color);
  display: block;
  position: relative;
  transition: opacity 180ms ease-out;
  z-index: 0;
}

@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .particle-title__fallback {
    background: linear-gradient(112deg, var(--particle-title-color), var(--particle-title-highlight));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.particle-title--canvas-ready .particle-title__fallback {
  opacity: 0;
}

.particle-title__canvas {
  display: block;
  height: 100%;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transition: opacity 180ms ease-out;
  width: 100%;
  z-index: 1;
}

.particle-title--canvas-ready .particle-title__canvas {
  opacity: 1;
}

.particle-title__sr {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .particle-title__fallback {
    opacity: 1;
    transition: none;
  }

  .particle-title__canvas {
    display: none;
  }
}

@media (forced-colors: active) {
  .particle-title__fallback,
  .particle-title--canvas-ready .particle-title__fallback {
    color: CanvasText !important;
    background: none !important;
    -webkit-text-fill-color: CanvasText;
    opacity: 1;
  }

  .particle-title__canvas {
    display: none;
  }
}
</style>
