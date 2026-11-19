import { useEffect, useRef } from 'react'

export interface WebGLFallbackProps {
  className?: string
  reducedMotion?: boolean
  type?: 'hero' | 'network' | 'generic'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
  pulseSpeed: number
  pulseOffset: number
}

const PALETTE = {
  cyan: '#18CFFC',
  skyBlue: '#07A4FC',
  cobalt: '#0D56FB',
  violet: '#7F1AFB',
  magenta: '#ED47FC',
  obsidian: '#08080A',
}

export function WebGLFallback({
  className = '',
  reducedMotion = false,
  type = 'hero',
}: WebGLFallbackProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isVisibleRef = useRef<boolean>(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = (canvas.width = container.clientWidth || window.innerWidth)
    let height = (canvas.height = container.clientHeight || window.innerHeight)

    const particleColors = [
      PALETTE.cyan,
      PALETTE.skyBlue,
      PALETTE.violet,
      PALETTE.magenta,
    ]

    const particleCount = type === 'network' ? 45 : 35
    const particles: Particle[] = []

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (reducedMotion ? 0 : 0.45),
        vy: (Math.random() - 0.5) * (reducedMotion ? 0 : 0.45),
        radius: Math.random() * 2.5 + 1.2,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        alpha: Math.random() * 0.6 + 0.25,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        pulseOffset: Math.random() * Math.PI * 2,
      })
    }

    // Grid config
    const gridSize = 48
    let gridOffset = 0

    // Resize handler
    const handleResize = () => {
      if (!canvas || !container) return
      width = canvas.width = container.clientWidth || window.innerWidth
      height = canvas.height = container.clientHeight || window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    // Visibility observer to save CPU/GPU cycles when off-screen
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting
        if (entry.isIntersecting && !reducedMotion && !animFrameRef.current) {
          animFrameRef.current = requestAnimationFrame(render)
        }
      },
      { threshold: 0.05 }
    )
    observer.observe(container)

    let tick = 0

    const render = () => {
      if (!isVisibleRef.current) {
        animFrameRef.current = null
        return
      }

      tick += 0.015
      ctx.clearRect(0, 0, width, height)

      // 1. Draw subtle futuristic grid lines
      ctx.strokeStyle = 'rgba(24, 207, 252, 0.035)'
      ctx.lineWidth = 1

      if (!reducedMotion) {
        gridOffset = (gridOffset + 0.15) % gridSize
      }

      ctx.beginPath()
      // Vertical grid
      for (let x = 0; x < width; x += gridSize) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }
      // Horizontal moving grid lines
      for (let y = gridOffset; y < height; y += gridSize) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
      ctx.stroke()

      // 2. Network constellation connections
      const maxDist = type === 'network' ? 120 : 90
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.hypot(dx, dy)

          if (dist < maxDist) {
            const lineAlpha = (1 - dist / maxDist) * 0.18
            ctx.strokeStyle = `rgba(127, 26, 251, ${lineAlpha})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      // 3. Render glowing particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        if (!reducedMotion) {
          p.x += p.vx
          p.y += p.vy

          // Wrap edges
          if (p.x < 0) p.x = width
          else if (p.x > width) p.x = 0
          if (p.y < 0) p.y = height
          else if (p.y > height) p.y = 0
        }

        const currentAlpha =
          p.alpha *
          (0.7 + 0.3 * Math.sin(tick * p.pulseSpeed * 60 + p.pulseOffset))

        ctx.save()
        ctx.globalAlpha = Math.max(0.1, Math.min(1, currentAlpha))
        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      if (!reducedMotion) {
        animFrameRef.current = requestAnimationFrame(render)
      }
    }

    // Initial render
    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      observer.disconnect()
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [reducedMotion, type])

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#08080A] pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      {/* Dynamic Ambient Glowing Gradient Orbs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-25 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, #18CFFC 0%, #0D56FB 60%, transparent 80%)',
        }}
      />
      <div
        className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full blur-[140px] opacity-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, #7F1AFB 0%, #ED47FC 50%, transparent 80%)',
        }}
      />
      <div
        className="absolute -bottom-32 left-1/4 w-[420px] h-[420px] rounded-full blur-[130px] opacity-15 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, #07A4FC 0%, #18CFFC 50%, transparent 80%)',
        }}
      />

      {/* 2D Canvas particles and grid */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />

      {/* Cybernetic vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 40%, rgba(8, 8, 10, 0.8) 100%)',
        }}
      />
    </div>
  )
}

export default WebGLFallback
