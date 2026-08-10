import { useEffect, useRef } from 'react'
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

// Adapted from React Bits Threads. See THIRD_PARTY_NOTICES.md.
const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec2 uMouse;

#define PI 3.1415926538

const int lineCount = 32;
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
  float amplitude = amplitudeNormal * 0.28 * (1.0 + (mouse.y - 0.5) * 0.10);
  float scaledTime = time / 12.0 + (mouse.x - 0.5) * 0.35;
  float blur = smoothstep(splitPoint, splitPoint + 0.05, point.x) * percentage;

  float noise = mix(
    perlin2D(vec2(scaledTime, point.x + percentage) * 2.5),
    perlin2D(vec2(scaledTime, point.x + scaledTime) * 3.5) / 1.5,
    point.x * 0.3
  );

  float y = 0.5 + (percentage - 0.5) * 0.15 + noise / 2.0 * amplitude;
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
  gl_FragColor = vec4(vec3(value), value);
}
`

export default function Threads() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: Renderer | null = null
    let frameId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let canvas: HTMLCanvasElement | null = null
    let isOnscreen = true
    let isDocumentVisible = !document.hidden
    let isDisposed = false

    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointerQuery = window.matchMedia('(pointer: fine)')
    let reducedMotion = reducedMotionQuery.matches
    const hasFinePointer = finePointerQuery.matches

    try {
      renderer = new Renderer({ alpha: true, dpr: 1 })
      const gl = renderer.gl
      canvas = gl.canvas
      canvas.setAttribute('aria-hidden', 'true')
      container.appendChild(canvas)

      gl.clearColor(0, 0, 0, 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      const geometry = new Triangle(gl)
      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Color(1, 1, 1) },
          uMouse: { value: new Float32Array([0.5, 0.5]) },
        },
      })
      const mesh = new Mesh(gl, { geometry, program })

      const currentMouse = [0.5, 0.5]
      let targetMouse = [0.5, 0.5]

      const renderFrame = (time: number) => {
        program.uniforms.iTime.value = reducedMotion ? 0 : time * 0.001

        if (hasFinePointer && !reducedMotion) {
          currentMouse[0] += (targetMouse[0] - currentMouse[0]) * 0.045
          currentMouse[1] += (targetMouse[1] - currentMouse[1]) * 0.045
          program.uniforms.uMouse.value[0] = currentMouse[0]
          program.uniforms.uMouse.value[1] = currentMouse[1]
        }

        renderer?.render({ scene: mesh })
      }

      const shouldAnimate = () => !reducedMotion && isOnscreen && isDocumentVisible && !isDisposed

      const tick = (time: number) => {
        frameId = null
        if (!shouldAnimate()) return
        renderFrame(time)
        frameId = window.requestAnimationFrame(tick)
      }

      const syncAnimation = () => {
        if (shouldAnimate() && frameId === null) {
          frameId = window.requestAnimationFrame(tick)
        } else if (!shouldAnimate() && frameId !== null) {
          window.cancelAnimationFrame(frameId)
          frameId = null
        }
      }

      const resize = () => {
        if (!renderer) return
        const { clientWidth, clientHeight } = container
        if (!clientWidth || !clientHeight) return

        const maxRenderDimension = 1920
        const baseDpr = Math.min(window.devicePixelRatio || 1, 1.5)
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

      const handlePointerMove = (event: PointerEvent) => {
        const rect = container.getBoundingClientRect()
        targetMouse = [
          (event.clientX - rect.left) / Math.max(rect.width, 1),
          1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
        ]
      }

      const handlePointerLeave = () => {
        targetMouse = [0.5, 0.5]
      }

      const handleVisibilityChange = () => {
        isDocumentVisible = !document.hidden
        syncAnimation()
      }

      const handleMotionPreferenceChange = (event: MediaQueryListEvent) => {
        reducedMotion = event.matches
        if (reducedMotion) {
          currentMouse[0] = 0.5
          currentMouse[1] = 0.5
          targetMouse = [0.5, 0.5]
          renderFrame(0)
        }
        syncAnimation()
      }

      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)

      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isOnscreen = entry?.isIntersecting ?? false
          syncAnimation()
        },
        { threshold: 0 },
      )
      intersectionObserver.observe(container)

      document.addEventListener('visibilitychange', handleVisibilityChange)
      reducedMotionQuery.addEventListener('change', handleMotionPreferenceChange)
      if (hasFinePointer) {
        container.addEventListener('pointermove', handlePointerMove)
        container.addEventListener('pointerleave', handlePointerLeave)
      }

      resize()
      if (reducedMotion) renderFrame(0)
      syncAnimation()

      return () => {
        isDisposed = true
        if (frameId !== null) window.cancelAnimationFrame(frameId)
        resizeObserver?.disconnect()
        intersectionObserver?.disconnect()
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        reducedMotionQuery.removeEventListener('change', handleMotionPreferenceChange)
        container.removeEventListener('pointermove', handlePointerMove)
        container.removeEventListener('pointerleave', handlePointerLeave)
        if (canvas && container.contains(canvas)) container.removeChild(canvas)
        gl.getExtension('WEBGL_lose_context')?.loseContext()
      }
    } catch {
      container.dataset.webgl = 'unavailable'
      if (canvas && container.contains(canvas)) container.removeChild(canvas)
      return () => {
        isDisposed = true
      }
    }
  }, [])

  return <div ref={containerRef} className="threads" aria-hidden="true" />
}
