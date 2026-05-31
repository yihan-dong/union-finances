'use client'

import { useRef, useEffect } from 'react'

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
  precision highp float;

  uniform vec2  resolution;
  uniform float time;
  uniform vec2  mouse;
  uniform bool  polar_coordinates;
  uniform vec2  polar_center;
  uniform float polar_zoom;
  uniform float polar_repeat;
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

  vec2 polar_coords(vec2 uv, vec2 center, float zoom, float repeat) {
    vec2 dir = uv - center;
    float radius = length(dir) * 2.0;
    float angle  = atan(dir.y, dir.x) / (PI * 2.0);
    return mod(vec2(radius * zoom, angle * repeat), 1.0);
  }

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
    speed = time * spin_speed;
    vec2 uv2 = vec2(uv.x + uv.y);

    for (int i = 0; i < 5; i++) {
      uv2 += sin(max(uv.x, uv.y)) + uv;
      uv  += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
                        sin(uv2.x - 0.113 * speed));
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
    vec2 coords = polar_coordinates
      ? polar_coords(vUv, polar_center, polar_zoom, polar_repeat)
      : vUv;
    gl_FragColor = effect(resolution, coords * resolution);
  }
`

// ── Union brand colours (RGB 0–1) ──────────────────────────
// colour_1 → Yihan purple  #534AB7  → 0.325, 0.290, 0.718
// colour_2 → Sun green     #1D9E75  → 0.114, 0.620, 0.459
// colour_3 → warm white    #F7F6F3  → 0.969, 0.965, 0.953
const COLOUR_1: [number, number, number] = [0.325, 0.290, 0.718]
const COLOUR_2: [number, number, number] = [0.114, 0.620, 0.459]
const COLOUR_3: [number, number, number] = [0.969, 0.965, 0.953]

// ── Component ──────────────────────────────────────────────
export function FluidSwirl() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const rafRef       = useRef<number>(0)
  const startTimeRef = useRef(Date.now())
  const mouseRef     = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: false, premultipliedAlpha: false })
    if (!gl) return

    // ── Compile shader ─────────────────────────────────────
    function compile(type: number, src: string) {
      const s = gl!.createShader(type)!
      gl!.shaderSource(s, src)
      gl!.compileShader(s)
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        console.error(gl!.getShaderInfoLog(s))
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
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog))
      return
    }

    // ── Uniform locations ──────────────────────────────────
    const u = {
      resolution:       gl.getUniformLocation(prog, 'resolution'),
      time:             gl.getUniformLocation(prog, 'time'),
      mouse:            gl.getUniformLocation(prog, 'mouse'),
      polar_coordinates:gl.getUniformLocation(prog, 'polar_coordinates'),
      polar_center:     gl.getUniformLocation(prog, 'polar_center'),
      polar_zoom:       gl.getUniformLocation(prog, 'polar_zoom'),
      polar_repeat:     gl.getUniformLocation(prog, 'polar_repeat'),
      spin_rotation:    gl.getUniformLocation(prog, 'spin_rotation'),
      spin_speed:       gl.getUniformLocation(prog, 'spin_speed'),
      offset:           gl.getUniformLocation(prog, 'offset'),
      colour_1:         gl.getUniformLocation(prog, 'colour_1'),
      colour_2:         gl.getUniformLocation(prog, 'colour_2'),
      colour_3:         gl.getUniformLocation(prog, 'colour_3'),
      contrast:         gl.getUniformLocation(prog, 'contrast'),
      spin_amount:      gl.getUniformLocation(prog, 'spin_amount'),
      pixel_filter:     gl.getUniformLocation(prog, 'pixel_filter'),
    }

    // ── Full-screen quad ───────────────────────────────────
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'position')

    // ── Resize ─────────────────────────────────────────────
    function resize() {
      const dpr = window.devicePixelRatio || 1
      canvas!.width  = window.innerWidth  * dpr
      canvas!.height = window.innerHeight * dpr
      canvas!.style.width  = window.innerWidth  + 'px'
      canvas!.style.height = window.innerHeight + 'px'
      gl!.viewport(0, 0, canvas!.width, canvas!.height)
    }

    // ── Mouse / touch ──────────────────────────────────────
    function onPointer(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect()
      const src  = 'touches' in e ? e.touches[0] : e as MouseEvent
      mouseRef.current.x = (src.clientX - rect.left)  / rect.width
      mouseRef.current.y = 1 - (src.clientY - rect.top) / rect.height
    }

    // ── Render loop ────────────────────────────────────────
    function render() {
      const t = (Date.now() - startTimeRef.current) / 1000

      gl!.useProgram(prog)

      gl!.uniform2f(u.resolution, canvas!.width, canvas!.height)
      gl!.uniform1f(u.time, t)
      gl!.uniform2f(u.mouse, mouseRef.current.x, mouseRef.current.y)

      gl!.uniform1i(u.polar_coordinates, 0)
      gl!.uniform2f(u.polar_center, 0.5, 0.5)
      gl!.uniform1f(u.polar_zoom, 1.0)
      gl!.uniform1f(u.polar_repeat, 1.0)

      gl!.uniform1f(u.spin_rotation, t * 0.4 + mouseRef.current.x * Math.PI)
      gl!.uniform1f(u.spin_speed, 0.6)        // gentle, not frantic
      gl!.uniform2f(u.offset, 0.0, 0.0)

      gl!.uniform3fv(u.colour_1, COLOUR_1)
      gl!.uniform3fv(u.colour_2, COLOUR_2)
      gl!.uniform3fv(u.colour_3, COLOUR_3)

      gl!.uniform1f(u.contrast,     1.4)       // softer than default 2.0
      gl!.uniform1f(u.spin_amount,  0.30)       // subtle swirl
      gl!.uniform1f(u.pixel_filter, 800.0)      // slightly silky

      gl!.bindBuffer(gl!.ARRAY_BUFFER, buf)
      gl!.enableVertexAttribArray(posLoc)
      gl!.vertexAttribPointer(posLoc, 2, gl!.FLOAT, false, 0, 0)
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4)

      rafRef.current = requestAnimationFrame(render)
    }

    resize()
    render()

    window.addEventListener('resize',     resize)
    window.addEventListener('mousemove',  onPointer)
    window.addEventListener('touchstart', onPointer, { passive: true })
    window.addEventListener('touchmove',  onPointer, { passive: true })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize',     resize)
      window.removeEventListener('mousemove',  onPointer)
      window.removeEventListener('touchstart', onPointer)
      window.removeEventListener('touchmove',  onPointer)
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
      style={{ display: 'block', touchAction: 'none' }}
    />
  )
}
