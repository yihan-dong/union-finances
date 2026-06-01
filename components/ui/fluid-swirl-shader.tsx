'use client'

import { useRef, useEffect, useState } from 'react'

// ── Shaders ────────────────────────────────────────────────
const vertexShader = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShader = `
  precision mediump float;

  uniform vec2  resolution;
  uniform float time;
  uniform float spin_rotation;
  uniform float spin_speed;
  uniform vec2  offset;
  uniform vec3  colour_1;
  uniform vec3  colour_2;
  uniform vec3  colour_3;
  uniform float contrast;
  uniform float spin_amount;
  uniform float pixel_filter;

  varying vec2 vUv;

  #define PI 3.14159265359
  #define SPIN_EASE 1.0

  vec4 effect(vec2 screenSize, vec2 screen_coords) {
    float pixel_size = length(screenSize) / pixel_filter;
    vec2 uv = (floor(screen_coords * (1.0 / pixel_size)) * pixel_size
               - 0.5 * screenSize) / length(screenSize) - offset;
    float uv_len = length(uv);

    float speed = (spin_rotation * SPIN_EASE * 0.2) + 302.2;
    float new_pixel_angle = atan(uv.y, uv.x) + speed
      - SPIN_EASE * 20.0 * (spin_amount * uv_len + (1.0 - spin_amount));
    vec2 mid = (screenSize / length(screenSize)) / 2.0;
    uv = vec2(uv_len * cos(new_pixel_angle) + mid.x,
              uv_len * sin(new_pixel_angle) + mid.y) - mid;

    uv *= 30.0;
    float speed2 = time * spin_speed;
    vec2 uv2 = vec2(uv.x + uv.y);

    for (int i = 0; i < 5; i++) {
      uv2 += sin(max(uv.x, uv.y)) + uv;
      uv  += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed2 * 0.131121),
                        sin(uv2.x - 0.113 * speed2));
      uv  -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
    }

    float contrast_mod = 0.25 * contrast + 0.5 * spin_amount + 1.2;
    float paint_res    = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
    float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
    float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
    float c3p = 1.0 - min(1.0, c1p + c2p);

    vec3 col = (0.3 / contrast) * colour_1
      + (1.0 - 0.3 / contrast) * (colour_1 * c1p + colour_2 * c2p + colour_3 * c3p);

    return vec4(col, 1.0);
  }

  void main() {
    gl_FragColor = effect(resolution, vUv * resolution);
  }
`

const COLOUR_1: [number, number, number] = [0.325, 0.290, 0.718]
const COLOUR_2: [number, number, number] = [0.114, 0.620, 0.459]
const COLOUR_3: [number, number, number] = [0.969, 0.965, 0.953]

// Detect Android — skip the live shader, show a static gradient instead
function isAndroid() {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

// Static fallback: same brand colours as a CSS radial gradient
export function FluidSwirlFallback() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 20% 30%, rgba(83,74,183,0.22) 0%, transparent 70%),
          radial-gradient(ellipse 60% 80% at 80% 70%, rgba(29,158,117,0.18) 0%, transparent 65%),
          radial-gradient(ellipse 50% 50% at 50% 50%, rgba(247,246,243,0.6) 0%, transparent 100%)
        `,
      }}
    />
  )
}

export function FluidSwirl() {
  const [android, setAndroid] = useState(false)

  useEffect(() => {
    setAndroid(isAndroid())
  }, [])

  if (android) return <FluidSwirlFallback />
  return <FluidSwirlCanvas />
}

function FluidSwirlCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: false, premultipliedAlpha: false, antialias: false })
    if (!gl) return

    // ── Compile shader ─────────────────────────────────────
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(s)
        return null
      }
      return s
    }

    const vs = compile(gl.VERTEX_SHADER,   vertexShader)
    const fs = compile(gl.FRAGMENT_SHADER, fragmentShader)
    if (!vs || !fs) return

    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return

    const u = {
      resolution:    gl.getUniformLocation(prog, 'resolution'),
      time:          gl.getUniformLocation(prog, 'time'),
      spin_rotation: gl.getUniformLocation(prog, 'spin_rotation'),
      spin_speed:    gl.getUniformLocation(prog, 'spin_speed'),
      offset:        gl.getUniformLocation(prog, 'offset'),
      colour_1:      gl.getUniformLocation(prog, 'colour_1'),
      colour_2:      gl.getUniformLocation(prog, 'colour_2'),
      colour_3:      gl.getUniformLocation(prog, 'colour_3'),
      contrast:      gl.getUniformLocation(prog, 'contrast'),
      spin_amount:   gl.getUniformLocation(prog, 'spin_amount'),
      pixel_filter:  gl.getUniformLocation(prog, 'pixel_filter'),
    }

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'position')

    // Cap DPR at 1.5 — prevents 3× render resolution on high-DPR phones
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    function resize() {
      canvas!.width  = Math.round(window.innerWidth  * dpr)
      canvas!.height = Math.round(window.innerHeight * dpr)
      canvas!.style.width  = window.innerWidth  + 'px'
      canvas!.style.height = window.innerHeight + 'px'
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }

    // Throttle to 30fps — enough for a background effect, halves GPU load
    const FRAME_MS = 1000 / 30
    let lastFrame = 0

    function render(now: number) {
      rafRef.current = requestAnimationFrame(render)
      if (now - lastFrame < FRAME_MS) return
      lastFrame = now

      const t = (Date.now() - startTimeRef.current) / 1000

      gl!.useProgram(prog)
      gl!.uniform2f(u.resolution, canvas!.width, canvas!.height)
      gl!.uniform1f(u.time, t)
      gl!.uniform1f(u.spin_rotation, t * 0.4)
      gl!.uniform1f(u.spin_speed,    0.6)
      gl!.uniform2f(u.offset,        0.0, 0.0)
      gl!.uniform3fv(u.colour_1, COLOUR_1)
      gl!.uniform3fv(u.colour_2, COLOUR_2)
      gl!.uniform3fv(u.colour_3, COLOUR_3)
      gl!.uniform1f(u.contrast,     1.4)
      gl!.uniform1f(u.spin_amount,  0.30)
      gl!.uniform1f(u.pixel_filter, 800.0)

      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
      gl!.enableVertexAttribArray(posLoc)
      gl!.vertexAttribPointer(posLoc, 2, gl!.FLOAT, false, 0, 0)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)
    }

    resize()
    rafRef.current = requestAnimationFrame(render)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ display: 'block' }}
    />
  )
}
