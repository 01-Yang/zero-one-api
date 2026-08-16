import { useEffect, useRef, type RefObject } from 'react'
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl'

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// Adapted from React Bits Threads. See THIRD_PARTY_NOTICES.txt.
const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uColor;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;

#define PI 3.1415926538

const int lineCount = 40;
const float lineWidth = 7.0;
const float lineBlur = 10.0;

float perlin2D(vec2 point) {
  vec2 cell = floor(point);
  vec4 delta = point.xyxy - vec4(cell, cell + 1.0);
  vec4 lattice = vec4(cell.xy, cell.xy + 1.0);
  lattice = lattice - floor(lattice * (1.0 / 71.0)) * 71.0;
  lattice += vec2(26.0, 161.0).xyxy;
  lattice *= lattice;
  lattice = lattice.xzxz * lattice.yyww;
  vec4 hashX = fract(lattice * (1.0 / 951.135664));
  vec4 hashY = fract(lattice * (1.0 / 642.949883));
  vec4 gradientX = hashX - 0.49999;
  vec4 gradientY = hashY - 0.49999;
  vec4 gradient = inversesqrt(gradientX * gradientX + gradientY * gradientY)
    * (gradientX * delta.xzxz + gradientY * delta.yyww);
  gradient *= 1.4142135623730950;
  vec2 blend = delta.xy * delta.xy * delta.xy
    * (delta.xy * (delta.xy * 6.0 - 15.0) + 10.0);
  vec4 blendWeights = vec4(blend, vec2(1.0 - blend));
  return dot(gradient, blendWeights.zxzx * blendWeights.wwyy);
}

float pixel(float count, vec2 resolution) {
  return (1.0 / max(resolution.x, resolution.y)) * count;
}

float lineShape(
  vec2 point,
  float width,
  float percentage,
  vec2 mouse,
  float time
) {
  float splitPoint = 0.1 + percentage * 0.4;
  float amplitudeNormal = smoothstep(splitPoint, 0.7, point.x);
  float amplitude = amplitudeNormal * 0.5 * uAmplitude
    * (1.0 + (mouse.y - 0.5) * 0.2);
  float scaledTime = time / 10.0 + (mouse.x - 0.5);
  float blur = smoothstep(splitPoint, splitPoint + 0.05, point.x) * percentage;

  float noise = mix(
    perlin2D(vec2(scaledTime, point.x + percentage) * 2.5),
    perlin2D(vec2(scaledTime, point.x + scaledTime) * 3.5) / 1.5,
    point.x * 0.3
  );

  float y = 0.5 + (percentage - 0.5) * uDistance + noise / 2.0 * amplitude;
  float start = smoothstep(
    y + width / 2.0 + lineBlur * pixel(1.0, iResolution.xy) * blur,
    y,
    point.y
  );
  float end = smoothstep(
    y,
    y - width / 2.0 - lineBlur * pixel(1.0, iResolution.xy) * blur,
    point.y
  );

  return clamp(
    (start - end) * (1.0 - smoothstep(0.0, 1.0, pow(percentage, 0.3))),
    0.0,
    1.0
  );
}

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  float strength = 1.0;

  for (int i = 0; i < lineCount; i++) {
    float percentage = float(i) / float(lineCount);
    strength *= 1.0 - lineShape(
      uv,
      lineWidth * pixel(1.0, iResolution.xy) * (1.0 - percentage),
      percentage,
      uMouse,
      iTime
    );
  }

  float value = 1.0 - strength;
  gl_FragColor = vec4(uColor * value, value);
}
`

export interface ThreadsProps {
  mode?: 'animated' | 'static'
  color?: readonly [number, number, number]
  amplitude?: number
  distance?: number
  enableMouseInteraction?: boolean
  interactionTargetRef?: RefObject<HTMLElement | null>
  persistent?: boolean
  className?: string
}

export default function Threads({
  mode = 'animated',
  color = [1, 1, 1],
  amplitude = 1,
  distance = 0,
  enableMouseInteraction = true,
  interactionTargetRef,
  persistent = false,
  className = '',
}: ThreadsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const visualPropsRef = useRef({ color, amplitude, distance, enableMouseInteraction })
  visualPropsRef.current = { color, amplitude, distance, enableMouseInteraction }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: Renderer | null = null
    let frameId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let canvas: HTMLCanvasElement | null = null
    let loseContext: (() => void) | null = null
    let isOnscreen = true
    let isDocumentVisible = !document.hidden
    let isDisposed = false
    let isContextLost = false
    let resizeFallbackAttached = false
    let pointerListenersAttached = false
    let pointerResetListenersAttached = false
    let visibilityListenerAttached = false
    let motionListenerAttached = false
    let mobileListenerAttached = false

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointerQuery = window.matchMedia('(pointer: fine)')
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    let reducedMotion = reducedMotionQuery.matches
    const hasFinePointer = finePointerQuery.matches
    let isMobile = mobileQuery.matches
    let minimumFrameInterval = isMobile ? 1000 / 30 : 1000 / 60
    const interactionElement = interactionTargetRef?.current ?? container

    const stopAnimation = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
        frameId = null
      }
    }

    const cleanup = () => {
      if (isDisposed) return
      isDisposed = true
      stopAnimation()
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      if (resizeFallbackAttached) window.removeEventListener('resize', resize)
      if (visibilityListenerAttached) {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
      if (motionListenerAttached) {
        reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange)
      }
      if (mobileListenerAttached) {
        mobileQuery.removeEventListener('change', handleMobilePreferenceChange)
      }
      if (pointerListenersAttached) {
        if (persistent) {
          window.removeEventListener('pointermove', handlePointerMove)
          window.removeEventListener('pointerleave', handlePointerLeave)
        } else {
          interactionElement.removeEventListener('pointermove', handlePointerMove)
          interactionElement.removeEventListener('pointerleave', handlePointerLeave)
        }
      }
      if (pointerResetListenersAttached) {
        window.removeEventListener('blur', handlePointerLeave)
        document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
        document.documentElement.removeEventListener('pointerout', handleRootPointerOut)
      }
      canvas?.removeEventListener('webglcontextlost', handleContextLost)
      if (canvas && container.contains(canvas)) container.removeChild(canvas)
      loseContext?.()
    }

    let resize = () => {}
    let handlePointerMove = (_event: PointerEvent) => {}
    let handlePointerLeave = () => {}
    let handleRootPointerOut = (_event: PointerEvent) => {}
    let handleVisibilityChange = () => {}
    let handleMotionPreferenceChange = (_event: MediaQueryListEvent) => {}
    let handleMobilePreferenceChange = (_event: MediaQueryListEvent) => {}
    let handleContextLost = (_event: Event) => {}

    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, dpr: 1 })
      const gl = renderer.gl
      canvas = gl.canvas
      canvas.setAttribute('aria-hidden', 'true')
      canvas.setAttribute('role', 'presentation')
      container.appendChild(canvas)
      container.dataset.webgl = 'ready'
      loseContext = () => gl.getExtension('WEBGL_lose_context')?.loseContext()

      gl.clearColor(0, 0, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

      const geometry = new Triangle(gl)
      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Color(1, 1, 1) },
          uColor: { value: new Color(...visualPropsRef.current.color) },
          uAmplitude: { value: visualPropsRef.current.amplitude },
          uDistance: { value: visualPropsRef.current.distance },
          uMouse: { value: new Float32Array([0.5, 0.5]) },
        },
      })
      const mesh = new Mesh(gl, { geometry, program })

      const currentMouse = [0.5, 0.5]
      let targetMouse = [0.5, 0.5]
      let lastRenderTime = Number.NEGATIVE_INFINITY

      const renderFrame = (time: number) => {
        const visual = visualPropsRef.current
        program.uniforms.uColor.value.set(...visual.color)
        program.uniforms.uAmplitude.value = visual.amplitude
        program.uniforms.uDistance.value = visual.distance
        program.uniforms.iTime.value = reducedMotion || mode === 'static' ? 0 : time * 0.001

        if (
          visual.enableMouseInteraction &&
          hasFinePointer &&
          !reducedMotion &&
          mode === 'animated'
        ) {
          currentMouse[0] += (targetMouse[0] - currentMouse[0]) * 0.05
          currentMouse[1] += (targetMouse[1] - currentMouse[1]) * 0.05
          program.uniforms.uMouse.value[0] = currentMouse[0]
          program.uniforms.uMouse.value[1] = currentMouse[1]
        } else {
          program.uniforms.uMouse.value[0] = 0.5
          program.uniforms.uMouse.value[1] = 0.5
        }

        renderer?.render({ scene: mesh })
      }

      const shouldAnimate = () =>
        mode === 'animated' &&
        !reducedMotion &&
        (persistent || isOnscreen) &&
        isDocumentVisible &&
        !isDisposed &&
        !isContextLost

      const tick = (time: number) => {
        frameId = null
        if (!shouldAnimate()) return
        if (time - lastRenderTime >= minimumFrameInterval) {
          lastRenderTime = time
          renderFrame(time)
        }
        frameId = window.requestAnimationFrame(tick)
      }

      const syncAnimation = () => {
        if (shouldAnimate() && frameId === null) {
          frameId = window.requestAnimationFrame(tick)
        } else if (!shouldAnimate() && frameId !== null) {
          stopAnimation()
        }
      }

      resize = () => {
        if (!renderer) return
        const { clientWidth, clientHeight } = container
        if (!clientWidth || !clientHeight) return

        const maxRenderDimension = 1920
        const baseDpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
        const longestSide = Math.max(clientWidth, clientHeight) * baseDpr
        const dpr =
          longestSide > maxRenderDimension
            ? (baseDpr * maxRenderDimension) / longestSide
            : baseDpr

        renderer.dpr = dpr
        renderer.setSize(clientWidth, clientHeight)
        program.uniforms.iResolution.value.set(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / Math.max(gl.canvas.height, 1),
        )
        renderFrame(0)
      }

      handlePointerMove = (event: PointerEvent) => {
        const rect = container.getBoundingClientRect()
        targetMouse = [
          Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(rect.width, 1))),
          Math.min(1, Math.max(0, 1 - (event.clientY - rect.top) / Math.max(rect.height, 1))),
        ]
      }

      handlePointerLeave = () => {
        targetMouse = [0.5, 0.5]
      }

      handleRootPointerOut = (event: PointerEvent) => {
        if (event.relatedTarget === null) handlePointerLeave()
      }

      handleVisibilityChange = () => {
        isDocumentVisible = !document.hidden
        syncAnimation()
      }

      handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
        reducedMotion = event.matches
        if (reducedMotion) {
          currentMouse[0] = 0.5
          currentMouse[1] = 0.5
          targetMouse = [0.5, 0.5]
          renderFrame(0)
        }
        syncAnimation()
      }

      handleMobilePreferenceChange = (event: MediaQueryListEvent) => {
        isMobile = event.matches
        minimumFrameInterval = isMobile ? 1000 / 30 : 1000 / 60
        lastRenderTime = Number.NEGATIVE_INFINITY
        resize()
      }

      handleContextLost = (event: Event) => {
        event.preventDefault()
        isContextLost = true
        container.dataset.webgl = 'unavailable'
        stopAnimation()
      }

      canvas.addEventListener('webglcontextlost', handleContextLost)

      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(container)
      } else {
        window.addEventListener('resize', resize)
        resizeFallbackAttached = true
      }

      if (!persistent && mode === 'animated' && typeof IntersectionObserver === 'function') {
        intersectionObserver = new IntersectionObserver(
          ([entry]) => {
            isOnscreen = entry?.isIntersecting ?? false
            syncAnimation()
          },
          { threshold: 0 },
        )
        intersectionObserver.observe(container)
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)
      visibilityListenerAttached = true
      reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange)
      motionListenerAttached = true
      mobileQuery.addEventListener('change', handleMobilePreferenceChange)
      mobileListenerAttached = true
      if (hasFinePointer && mode === 'animated') {
        if (persistent) {
          window.addEventListener('pointermove', handlePointerMove)
          window.addEventListener('pointerleave', handlePointerLeave)
        } else {
          interactionElement.addEventListener('pointermove', handlePointerMove)
          interactionElement.addEventListener('pointerleave', handlePointerLeave)
        }
        pointerListenersAttached = true
        window.addEventListener('blur', handlePointerLeave)
        document.documentElement.addEventListener('pointerleave', handlePointerLeave)
        document.documentElement.addEventListener('pointerout', handleRootPointerOut)
        pointerResetListenersAttached = true
      }

      resize()
      if (reducedMotion || mode === 'static') renderFrame(0)
      syncAnimation()

      return cleanup
    } catch {
      container.dataset.webgl = 'unavailable'
      cleanup()
      return undefined
    }
  }, [interactionTargetRef, mode, persistent])

  return (
    <div
      ref={containerRef}
      className={`threads threads--${mode}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
