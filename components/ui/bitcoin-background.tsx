'use client'
import { useRef, useEffect } from 'react'

interface Particle {
  x: number
  y: number
  size: number
  speedY: number
  rotation: number
  rotationSpeed: number
  opacity: number
}

interface Props {
  color?: string
  count?: number
}

export function BitcoinBackground({ color = '#F7931A', count = 22 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Detect Android — fewer particles, less rotation work
    const android = /Android/i.test(navigator.userAgent)
    const n = android ? Math.floor(count * 0.6) : count

    function resize() {
      // Cap render resolution to 1× — no need for retina on a background
      canvas!.width  = window.innerWidth
      canvas!.height = window.innerHeight
      canvas!.style.width  = window.innerWidth  + 'px'
      canvas!.style.height = window.innerHeight + 'px'
      ctx!.setTransform(1, 0, 0, 1, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Spread particles across the full height initially so it doesn't look empty
    const particles: Particle[] = Array.from({ length: n }, () => ({
      x:             Math.random() * canvas.width,
      y:             Math.random() * canvas.height,
      size:          Math.random() * 28 + 16,
      speedY:        Math.random() * 0.6 + 0.25,
      rotation:      Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.012,
      opacity:       Math.random() * 0.18 + 0.07,
    }))

    function draw(p: Particle) {
      ctx!.save()
      ctx!.translate(p.x, p.y)
      ctx!.rotate(p.rotation)
      ctx!.globalAlpha = p.opacity
      ctx!.strokeStyle = color
      ctx!.fillStyle   = color
      ctx!.lineWidth   = p.size / 14

      // Circle outline
      ctx!.beginPath()
      ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2)
      ctx!.stroke()

      // ₿ glyph centred in circle
      ctx!.font = `bold ${Math.round(p.size * 0.72)}px Arial`
      ctx!.textAlign    = 'center'
      ctx!.textBaseline = 'middle'
      ctx!.fillText('₿', 0, 1)

      ctx!.restore()
    }

    // 30fps throttle — plenty smooth for a background
    const FRAME_MS = 1000 / 30
    let lastFrame = 0
    let raf = 0

    function animate(now: number) {
      raf = requestAnimationFrame(animate)
      if (now - lastFrame < FRAME_MS) return
      lastFrame = now

      // Clear with transparent so the base #F7F6F3 body colour shows
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      for (const p of particles) {
        draw(p)
        p.y        += p.speedY
        p.rotation += p.rotationSpeed
        if (p.y > canvas!.height + p.size) {
          p.y = -p.size
          p.x = Math.random() * canvas!.width
        }
      }
    }

    raf = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [color, count])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ display: 'block', position: 'absolute', inset: 0 }}
    />
  )
}
