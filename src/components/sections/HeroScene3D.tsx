import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { Ticket, Sparkles, ShieldCheck } from 'lucide-react'

/**
 * Procedural canvas texture generator for the FestFlow Holographic VIP Pass.
 * Generates an ultra-crisp vector texture with metallic foil accents, micro-circuits,
 * and holographic security badges without external assets.
 */
function createHolographicPassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1536
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // 1. Rich dark obsidian base with luminous chromatic gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 1024, 1536)
  bgGrad.addColorStop(0, '#211648')
  bgGrad.addColorStop(0.35, '#15112e')
  bgGrad.addColorStop(0.75, '#0e0c1f')
  bgGrad.addColorStop(1, '#090815')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 1024, 1536)

  // 2. Subtle geometric grid matrix
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.08)'
  ctx.lineWidth = 1.5
  const gridSize = 48
  for (let x = gridSize; x < 1024; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 1536)
    ctx.stroke()
  }
  for (let y = gridSize; y < 1536; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(1024, y)
    ctx.stroke()
  }

  // 3. Top Security Header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  ctx.font = 'bold 36px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('FESTFLOW', 80, 110)

  ctx.fillStyle = 'rgba(6, 182, 212, 0.9)'
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.fillText('// OFFICIAL CAMPUS PASS', 80, 145)

  // Top-right status pill: "VERIFIED"
  ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(760, 80, 184, 52, 26)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#34d399'
  ctx.font = 'bold 18px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('● VERIFIED', 852, 113)
  ctx.textAlign = 'left'

  // 4. Central Holographic Foil Band
  const foilGrad = ctx.createLinearGradient(80, 240, 944, 480)
  foilGrad.addColorStop(0, 'rgba(192, 132, 252, 0.25)')
  foilGrad.addColorStop(0.3, 'rgba(6, 182, 212, 0.35)')
  foilGrad.addColorStop(0.7, 'rgba(217, 70, 239, 0.25)')
  foilGrad.addColorStop(1, 'rgba(192, 132, 252, 0.3)')

  ctx.fillStyle = foilGrad
  ctx.beginPath()
  ctx.roundRect(80, 220, 864, 420, 32)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Central Emblem Circles inside Foil
  ctx.save()
  ctx.translate(512, 430)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.arc(0, 0, 120, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)'
  ctx.setLineDash([8, 12])
  ctx.beginPath()
  ctx.arc(0, 0, 96, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Star symbol
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    const r = i % 2 === 0 ? 56 : 24
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // 5. Pass Details Section
  ctx.fillStyle = 'rgba(161, 161, 170, 0.9)'
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('ACCESS TIER', 80, 740)
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px "Space Grotesk", system-ui, sans-serif'
  ctx.fillText('ALL-ACCESS CAMPUS PASS', 80, 785)

  ctx.fillStyle = 'rgba(161, 161, 170, 0.9)'
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('SECURITY PROTOCOL', 80, 870)
  ctx.fillStyle = '#c084fc'
  ctx.font = 'bold 28px monospace'
  ctx.fillText('DIRECT UPI VERIFIED PASS', 80, 910)

  ctx.fillStyle = 'rgba(161, 161, 170, 0.9)'
  ctx.font = '600 20px system-ui, sans-serif'
  ctx.fillText('ISSUING GATE', 600, 870)
  ctx.fillStyle = '#38bdf8'
  ctx.font = 'bold 28px monospace'
  ctx.fillText('MAIN GATE / KIOSK #04', 600, 910)

  // 6. Horizontal Dashed Separation Line (Ticket Tear Line)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
  ctx.lineWidth = 3
  ctx.setLineDash([16, 12])
  ctx.beginPath()
  ctx.moveTo(80, 1020)
  ctx.lineTo(944, 1020)
  ctx.stroke()
  ctx.setLineDash([])

  // 7. Simulated Digital Barcode & QR Stamp
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(80, 1090, 864, 4)

  // Barcode lines
  const barcodeX = 80
  const barcodeY = 1130
  const barcodeH = 140
  let curX = barcodeX
  const pattern = [4, 8, 3, 12, 6, 4, 16, 2, 8, 10, 4, 14, 8, 6, 18, 4, 10, 8, 4, 14, 6, 8, 12, 4, 6, 16, 8, 4, 12, 10, 6, 8, 14, 4, 8, 12, 6, 4, 16, 8, 4, 10, 12, 4, 8]
  for (let i = 0; i < pattern.length; i++) {
    const w = pattern[i]
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.fillRect(curX, barcodeY, w, barcodeH)
    }
    curX += w + 8
    if (curX > 720) break
  }

  // QR Mini Matrix Frame
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)'
  ctx.lineWidth = 3
  ctx.strokeRect(780, 1130, 140, 140)
  ctx.fillStyle = 'rgba(6, 182, 212, 0.3)'
  ctx.fillRect(790, 1140, 40, 40)
  ctx.fillRect(870, 1140, 40, 40)
  ctx.fillRect(790, 1220, 40, 40)
  ctx.fillRect(850, 1200, 30, 30)

  // 8. Serial & Footer
  ctx.fillStyle = 'rgba(161, 161, 170, 0.8)'
  ctx.font = '600 22px monospace'
  ctx.fillText('HASH: 8F2A-E49C-FF26-NEXUS', 80, 1340)
  ctx.fillText('VALIDATED AT CAMPUS GATE NETWORK', 80, 1380)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * Procedural circular particle glow texture to eliminate harsh square points.
 */
function createParticleGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.25, 'rgba(192, 132, 252, 0.85)')
  gradient.addColorStop(0.6, 'rgba(6, 182, 212, 0.35)')
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * High-Fidelity CSS / SVG Glassmorphism Fallback Component.
 */
export function HolographicTicketFallback() {
  return (
    <div className="relative w-full h-[380px] sm:h-[480px] flex items-center justify-center pointer-events-none select-none">
      {/* Luminous Orbital Rings */}
      <div
        className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full border border-purple-500/35 animate-[spin_24s_linear_infinite]"
        style={{ boxShadow: '0 0 50px oklch(58% 0.26 285 / 0.25)' }}
      />
      <div
        className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full border border-cyan-500/25 animate-[spin_32s_linear_infinite_reverse]"
        style={{ transform: 'rotate(45deg)' }}
      />

      {/* Orbiting Satellite Chips */}
      <div className="absolute w-3.5 h-3.5 rounded-full bg-cyan-400 shadow-[0_0_15px_#38bdf8] top-12 left-16 animate-pulse" />
      <div className="absolute w-3 h-3 rounded-full bg-purple-400 shadow-[0_0_15px_#c084fc] bottom-14 right-16 animate-pulse" />

      {/* Holographic Ticket Pass Card */}
      <div className="relative w-64 sm:w-72 h-96 rounded-3xl p-6 glass-elevated border border-purple-500/40 shadow-[0_24px_70px_oklch(0%_0_0_/_0.75)] flex flex-col justify-between overflow-hidden">
        {/* Subtle iridescent sweep */}
        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/5 to-transparent rotate-45 pointer-events-none" />

        {/* Top Pass Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
          <span className="text-[11px] uppercase font-bold tracking-widest text-purple-300 flex items-center gap-1.5">
            <Sparkles size={13} className="text-cyan-400" /> FestFlow Pass
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-400">
            ● VERIFIED
          </span>
        </div>

        {/* Center Hologram Emblem */}
        <div className="my-auto text-center space-y-2 relative z-10">
          <div className="w-14 h-14 rounded-2xl gradient-brand mx-auto flex items-center justify-center text-white shadow-xl shadow-purple-500/30">
            <Ticket size={28} />
          </div>
          <h4 className="font-display font-bold text-base text-white">Campus Digital Pass</h4>
          <p className="text-xs text-zinc-400 flex items-center justify-center gap-1">
            <ShieldCheck size={13} className="text-cyan-400" /> Authorized Entry Credential
          </p>
        </div>

        {/* Bottom Barcode / Gate Identifier */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400 relative z-10">
          <span className="font-mono text-cyan-300">#FF-2026-NEXUS</span>
          <span className="text-zinc-500">GATE #01</span>
        </div>
      </div>
    </div>
  )
}

function HeroScene3DInner() {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [webGlSupported, setWebGlSupported] = useState<boolean | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Track disposables for cleanup
    const disposables: Array<{ dispose: () => void }> = []
    let animationFrameId: number | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let handleMouseMove: ((e: MouseEvent) => void) | null = null
    let handleScroll: (() => void) | null = null

    try {
      // ─── 1. WebGL Verification ─────────────────────────────────────────────
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
      if (!gl) {
        setWebGlSupported(false)
        return
      }
      setWebGlSupported(true)

      // ─── 2. Responsive Device Checks ───────────────────────────────────────
      const isMobile = window.innerWidth < 768
      const maxDpr = isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2)
      const particleCount = isMobile ? 28 : 56

      // ─── 3. Scene, Camera & Renderer ───────────────────────────────────────
      const scene = new THREE.Scene()

      const width = container.clientWidth || 480
      const height = container.clientHeight || 480
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
      camera.position.set(0, 0, 7.4)

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile,
        powerPreference: 'high-performance',
      })
      renderer.setSize(width, height)
      renderer.setPixelRatio(maxDpr)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      container.appendChild(renderer.domElement)

      // ─── 4. Chromatic Stage Lighting ───────────────────────────────────────
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
      scene.add(ambientLight)

      const frontKey = new THREE.DirectionalLight(0xffffff, 2.5)
      frontKey.position.set(0, 1.5, 6.5)
      scene.add(frontKey)

      const violetKey = new THREE.PointLight(0xa855f7, 36, 25)
      violetKey.position.set(3.8, 3.2, 3.2)
      scene.add(violetKey)

      const cyanRim = new THREE.PointLight(0x06b6d4, 30, 22)
      cyanRim.position.set(-3.6, -2.8, 2.5)
      scene.add(cyanRim)

      const fuchsiaBack = new THREE.PointLight(0xd946ef, 24, 18)
      fuchsiaBack.position.set(0, 2.4, -2.8)
      scene.add(fuchsiaBack)

      // ─── 5. Main Root Sculpture ───────────────────────────────────────────
      const rootGroup = new THREE.Group()
      scene.add(rootGroup)

      // Holographic Pass Texture
      const passTexture = createHolographicPassTexture()
      disposables.push(passTexture)

      // Ticket Geometry (Precision proportions: 2.35 x 3.45 x 0.08)
      const ticketGeo = new THREE.BoxGeometry(2.35, 3.45, 0.08)
      disposables.push(ticketGeo)

      const edgeMaterial = new THREE.MeshStandardMaterial({
        color: 0x6d28d9,
        metalness: 0.8,
        roughness: 0.25,
        emissive: 0x3b0764,
        emissiveIntensity: 0.45,
      })
      disposables.push(edgeMaterial)

      const passMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: passTexture,
        metalness: 0.15,
        roughness: 0.2,
        emissive: 0x1e1b4b,
        emissiveIntensity: 0.28,
      })
      disposables.push(passMaterial)

      const ticketMaterials = [
        edgeMaterial,
        edgeMaterial,
        edgeMaterial,
        edgeMaterial,
        passMaterial,
        passMaterial,
      ]

      const ticketMesh = new THREE.Mesh(ticketGeo, ticketMaterials)
      rootGroup.add(ticketMesh)

      // Edge outline highlight
      const edgeGeo = new THREE.EdgesGeometry(ticketGeo)
      disposables.push(edgeGeo)
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0xc084fc,
        transparent: true,
        opacity: 0.7,
      })
      disposables.push(edgeMat)
      const ticketEdges = new THREE.LineSegments(edgeGeo, edgeMat)
      ticketMesh.add(ticketEdges)

      // Physical side notch cutouts
      const notchMat = new THREE.MeshBasicMaterial({ color: 0x06050d })
      disposables.push(notchMat)
      const notchGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, isMobile ? 16 : 24)
      disposables.push(notchGeo)
      notchGeo.rotateX(Math.PI / 2)

      const leftNotch = new THREE.Mesh(notchGeo, notchMat)
      leftNotch.position.set(-1.18, 0, 0)
      ticketMesh.add(leftNotch)

      const rightNotch = new THREE.Mesh(notchGeo, notchMat)
      rightNotch.position.set(1.18, 0, 0)
      ticketMesh.add(rightNotch)

      // ─── 6. Interconnected Gyro Portal Rings ───────────────────────────────
      const ring1Geo = new THREE.TorusGeometry(2.4, 0.024, isMobile ? 12 : 16, isMobile ? 64 : 96)
      disposables.push(ring1Geo)
      const ring1Mat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 0.95,
        metalness: 0.9,
        roughness: 0.15,
      })
      disposables.push(ring1Mat)
      const ring1 = new THREE.Mesh(ring1Geo, ring1Mat)
      ring1.rotation.x = Math.PI / 3.2
      ring1.rotation.y = Math.PI / 5.5
      rootGroup.add(ring1)

      const ring2Geo = new THREE.TorusGeometry(2.7, 0.018, isMobile ? 12 : 16, isMobile ? 64 : 96)
      disposables.push(ring2Geo)
      const ring2Mat = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x0891b2,
        emissiveIntensity: 0.85,
        metalness: 0.9,
        roughness: 0.15,
      })
      disposables.push(ring2Mat)
      const ring2 = new THREE.Mesh(ring2Geo, ring2Mat)
      ring2.rotation.x = -Math.PI / 3.8
      ring2.rotation.z = Math.PI / 4.2
      rootGroup.add(ring2)

      // ─── 7. Orbiting Prismatic Satellite Chips ─────────────────────────────
      const satelliteGroup = new THREE.Group()
      rootGroup.add(satelliteGroup)

      const satelliteGeo = new THREE.OctahedronGeometry(0.11, 0)
      disposables.push(satelliteGeo)

      const satelliteMaterials = [
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.2, metalness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0x9333ea, emissiveIntensity: 1.2, metalness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xdb2777, emissiveIntensity: 1.2, metalness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 1.2, metalness: 0.8 }),
      ]
      satelliteMaterials.forEach((m) => disposables.push(m))

      const satellites: THREE.Mesh[] = []
      const satelliteOffsets = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]

      for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(satelliteGeo, satelliteMaterials[i])
        satelliteGroup.add(mesh)
        satellites.push(mesh)
      }

      // ─── 8. Soft Atmospheric Ambient Stardust Particles ───────────────────
      const particleGeo = new THREE.BufferGeometry()
      disposables.push(particleGeo)
      const positions = new Float32Array(particleCount * 3)
      const scales = new Float32Array(particleCount)

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        const radius = 2.2 + Math.random() * 2.8
        const theta = Math.random() * Math.PI * 2
        const phi = (Math.random() - 0.5) * Math.PI * 0.8
        positions[i3] = radius * Math.cos(phi) * Math.cos(theta)
        positions[i3 + 1] = radius * Math.sin(phi) + (Math.random() - 0.5) * 1.0
        positions[i3 + 2] = radius * Math.cos(phi) * Math.sin(theta)
        scales[i] = Math.random() * 0.6 + 0.4
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      particleGeo.setAttribute('scale', new THREE.BufferAttribute(scales, 1))

      const particleGlowTexture = createParticleGlowTexture()
      disposables.push(particleGlowTexture)

      const particleMat = new THREE.PointsMaterial({
        color: 0xe0e7ff,
        size: isMobile ? 0.08 : 0.12,
        map: particleGlowTexture,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      disposables.push(particleMat)

      const particlePoints = new THREE.Points(particleGeo, particleMat)
      scene.add(particlePoints)

      // ─── 9. Interactive Mouse Parallax & Scroll Reactivity ───────────────
      const targetMouse = { x: 0, y: 0 }
      const currentMouse = { x: 0, y: 0 }
      let targetScrollY = 0
      let currentScrollY = 0

      handleMouseMove = (e: MouseEvent) => {
        const nx = (e.clientX / window.innerWidth) * 2 - 1
        const ny = -(e.clientY / window.innerHeight) * 2 + 1
        targetMouse.x = nx * 0.45
        targetMouse.y = ny * 0.35
      }

      handleScroll = () => {
        targetScrollY = window.scrollY
      }

      if (!reducedMotion) {
        window.addEventListener('mousemove', handleMouseMove, { passive: true })
        window.addEventListener('scroll', handleScroll, { passive: true })
      }

      // ─── 10. Viewport Intersection Pausing ────────────────────────────────
      let isVisibleInViewport = true
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          isVisibleInViewport = entries[0].isIntersecting
        },
        { threshold: 0.1 }
      )
      intersectionObserver.observe(container)

      // ─── 11. Container Resize Handling ────────────────────────────────────
      resizeObserver = new ResizeObserver((entries) => {
        if (!entries[0] || !renderer) return
        const cr = entries[0].contentRect
        if (cr.width > 0 && cr.height > 0) {
          camera.aspect = cr.width / cr.height
          camera.updateProjectionMatrix()
          renderer.setSize(cr.width, cr.height)
        }
      })
      resizeObserver.observe(container)

      // ─── 12. 60 FPS Render Loop ───────────────────────────────────────────
      const clock = new THREE.Clock()

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate)

        if (!isVisibleInViewport) return

        const elapsed = clock.getElapsedTime()

        if (!reducedMotion) {
          // Smooth spring damping for mouse tilt & scroll progress
          currentMouse.x += (targetMouse.x - currentMouse.x) * 0.04
          currentMouse.y += (targetMouse.y - currentMouse.y) * 0.04
          currentScrollY += (targetScrollY - currentScrollY) * 0.06

          const scrollProgress = Math.min(Math.max(currentScrollY / (window.innerHeight * 0.85), 0), 1)

          // Floating ticket respiration motion combined with scroll reaction
          const floatY = Math.sin(elapsed * 1.25) * 0.12
          const floatRotZ = Math.sin(elapsed * 0.9) * 0.04
          const gentleYaw = Math.sin(elapsed * 0.6) * 0.18

          // Position smoothly descends and recedes in depth as user scrolls
          ticketMesh.position.y = floatY - scrollProgress * 1.4
          ticketMesh.position.z = -scrollProgress * 2.2
          ticketMesh.rotation.x = 0.12 + -currentMouse.y * 0.45 + Math.cos(elapsed * 0.8) * 0.03 + scrollProgress * 0.42
          ticketMesh.rotation.y = -0.25 + gentleYaw + currentMouse.x * 0.55 - scrollProgress * 0.35
          ticketMesh.rotation.z = floatRotZ + scrollProgress * 0.08
          
          const targetScale = Math.max(1 - scrollProgress * 0.22, 0.78)
          ticketMesh.scale.setScalar(targetScale)

          // Gyroscope Torus Rings Rotation (responds with slight velocity boost during scroll)
          const ringSpeed = 1 + scrollProgress * 0.6
          ring1.rotation.x = Math.PI / 3.2 + elapsed * 0.22 * ringSpeed
          ring1.rotation.y = Math.PI / 5.5 + elapsed * 0.15 * ringSpeed
          ring1.rotation.z = Math.sin(elapsed * 0.5) * 0.2

          ring2.rotation.x = -Math.PI / 3.8 - elapsed * 0.18 * ringSpeed
          ring2.rotation.y = elapsed * 0.25 * ringSpeed
          ring2.rotation.z = Math.PI / 4.2 + Math.cos(elapsed * 0.4) * 0.15

          // Satellite chips orbit
          for (let i = 0; i < satellites.length; i++) {
            const s = satellites[i]
            const angle = elapsed * 0.75 * ringSpeed + satelliteOffsets[i]
            const radius = 2.1 + Math.sin(elapsed * 1.5 + i) * 0.2
            s.position.x = Math.cos(angle) * radius
            s.position.y = Math.sin(angle * 0.8) * 0.65
            s.position.z = Math.sin(angle) * radius * 0.7
            s.rotation.x = elapsed * 2 + i
            s.rotation.y = elapsed * 2.5 + i
          }

          // Ambient particle cosmic rotation
          particlePoints.rotation.y = elapsed * 0.035
          particlePoints.rotation.x = Math.sin(elapsed * 0.02) * 0.05
        } else {
          // Reduced motion: static beauty isometric composition
          ticketMesh.rotation.x = 0.14
          ticketMesh.rotation.y = -0.22
          ticketMesh.position.y = 0
          ticketMesh.position.z = 0
          ticketMesh.scale.setScalar(1)
          ring1.rotation.z = 0.4
          ring2.rotation.z = -0.3
          for (let i = 0; i < satellites.length; i++) {
            const s = satellites[i]
            const angle = satelliteOffsets[i]
            s.position.set(Math.cos(angle) * 2.0, Math.sin(angle) * 0.5, Math.sin(angle) * 1.2)
          }
        }

        renderer?.render(scene, camera)
      }

      animate()
    } catch (err) {
      console.warn('WebGL HeroScene3D initialization failed. Falling back to CSS presentation:', err)
      setWebGlSupported(false)
      return
    }

    // ─── 13. Resource Cleanup on Unmount ────────────────────────────────────
    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      if (handleMouseMove) {
        window.removeEventListener('mousemove', handleMouseMove)
      }
      if (handleScroll) {
        window.removeEventListener('scroll', handleScroll)
      }
      intersectionObserver?.disconnect()
      resizeObserver?.disconnect()

      // Safely dispose all tracked resources
      for (const item of disposables) {
        try {
          item?.dispose()
        } catch {
          // ignore already disposed
        }
      }

      // WebGL Renderer disposal
      if (renderer) {
        try {
          renderer.dispose()
          if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement)
          }
        } catch {
          // ignore
        }
      }
    }
  }, [reducedMotion])

  // ─── 14. Fallback rendering ───────────────────────────────────────────────
  if (webGlSupported === false) {
    return <HolographicTicketFallback />
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[380px] sm:h-[480px] lg:h-[540px] flex items-center justify-center overflow-visible"
      aria-label="Interactive 3D digital campus event pass and connected orbital stage"
    />
  )
}

/**
 * Isolated Error Boundary to ensure HeroScene3D never crashes the host page.
 */
class HeroScene3DErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  public state = { hasError: false }

  public static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[HeroScene3D ErrorBoundary] Caught WebGL render exception:', error, info)
  }

  public render() {
    if (this.state.hasError) {
      return <HolographicTicketFallback />
    }
    return this.props.children
  }
}

export function HeroScene3D() {
  return (
    <HeroScene3DErrorBoundary>
      <HeroScene3DInner />
    </HeroScene3DErrorBoundary>
  )
}
