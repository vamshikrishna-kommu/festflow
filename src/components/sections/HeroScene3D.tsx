import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { Sparkles, Users, Calendar } from 'lucide-react'

/**
 * Procedural texture for the floating VIP Festival Pass
 * styled with the exact extracted FestFlow cyan-to-violet-to-magenta logo colors.
 */
function createFestivalPassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  // 1. Deep obsidian glass background
  const bg = ctx.createLinearGradient(0, 0, 512, 768)
  bg.addColorStop(0, '#0E0E14')
  bg.addColorStop(0.5, '#14141E')
  bg.addColorStop(1, '#08080C')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 768)

  // 2. Neon FestFlow header band
  const band = ctx.createLinearGradient(0, 0, 512, 0)
  band.addColorStop(0, '#18CFFC')
  band.addColorStop(0.35, '#07A4FC')
  band.addColorStop(0.7, '#7F1AFB')
  band.addColorStop(1, '#ED47FC')
  ctx.fillStyle = band
  ctx.fillRect(0, 0, 512, 120)

  // Text inside header
  ctx.fillStyle = '#08080C'
  ctx.font = 'bold 36px "Syne", "Inter", sans-serif'
  ctx.fillText('FESTFLOW', 36, 75)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = '600 16px "JetBrains Mono", monospace'
  ctx.textAlign = 'right'
  ctx.fillText('VIP PASS // 2026', 476, 72)
  ctx.textAlign = 'left'

  // 3. Central Hologram Emblem
  const centerGrad = ctx.createRadialGradient(256, 360, 20, 256, 360, 160)
  centerGrad.addColorStop(0, 'rgba(127, 26, 251, 0.4)')
  centerGrad.addColorStop(0.6, 'rgba(24, 207, 252, 0.15)')
  centerGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = centerGrad
  ctx.beginPath()
  ctx.arc(256, 360, 160, 0, Math.PI * 2)
  ctx.fill()

  // Emblem border rings
  ctx.strokeStyle = '#18CFFC'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(256, 360, 110, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = '#ED47FC'
  ctx.lineWidth = 1.5
  ctx.setLineDash([8, 8])
  ctx.beginPath()
  ctx.arc(256, 360, 92, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Pass title text
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 26px "Syne", "Inter", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ANNUAL TECH SYMPOSIUM', 256, 350)

  ctx.fillStyle = '#18CFFC'
  ctx.font = '600 15px "Inter", sans-serif'
  ctx.fillText('ALL-ACCESS CAMPUS ENTRY', 256, 385)

  // 4. Barcode / QR Simulation area
  ctx.fillStyle = '#181824'
  ctx.fillRect(40, 560, 432, 140)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.strokeRect(40, 560, 432, 140)

  // Draw simulated QR matrix squares
  ctx.fillStyle = '#18CFFC'
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if ((r + c) % 2 === 0 || (r === 0 && c === 4) || (r === 4 && c === 0)) {
        ctx.fillRect(65 + c * 20, 585 + r * 20, 16, 16)
      }
    }
  }

  // Barcode telemetry lines
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  for (let i = 0; i < 28; i++) {
    const x = 200 + i * 9
    const w = i % 3 === 0 ? 4 : i % 2 === 0 ? 2 : 1
    ctx.fillRect(x, 585, w, 60)
  }

  ctx.fillStyle = '#FE7EE8'
  ctx.font = '600 13px "JetBrains Mono", monospace'
  ctx.textAlign = 'left'
  ctx.fillText('TKT# FF-9821-X99', 200, 675)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/**
 * 2D High-Fidelity Fallback Component for devices without WebGL
 */
function CharacterDuoFallback() {
  return (
    <div className="relative w-full h-[480px] flex items-center justify-center select-none">
      {/* Background ambient glow */}
      <div
        className="absolute w-80 h-80 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(127,26,251,0.25) 0%, rgba(24,207,252,0.12) 50%, transparent 70%)',
          filter: 'blur(45px)',
        }}
      />

      {/* Floating 2D visual card */}
      <div className="relative w-72 sm:w-80 rounded-3xl p-6 bg-[#0E0E12] border border-[#18CFFC]/30 shadow-[0_24px_70px_rgba(0,0,0,0.85),0_0_30px_rgba(127,26,251,0.25)] flex flex-col justify-between overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <span className="text-[11px] uppercase font-bold tracking-widest text-[#18CFFC] flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#ED47FC]" /> 3D Experience Ready
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[#18CFFC]/15 border border-[#18CFFC]/40 text-[10px] font-bold text-[#18CFFC]">
            ● VERIFIED
          </span>
        </div>

        <div className="my-auto py-8 text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] mx-auto flex items-center justify-center text-white shadow-xl shadow-cyan-500/25">
            <Users size={32} />
          </div>
          <h4 className="font-display font-bold text-lg text-white">FestFlow Campus Duo</h4>
          <p className="text-xs text-zinc-400 max-w-[220px] mx-auto leading-relaxed">
            Organizers and students collaborating on the next generation of campus festivals.
          </p>
        </div>

        <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="font-mono text-[#18CFFC]">#FF-CHARACTERS</span>
          <span className="text-zinc-500 flex items-center gap-1">
            <Calendar size={12} /> FEST-2026
          </span>
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

    const disposables: Array<{ dispose: () => void }> = []
    let animationFrameId: number | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let intersectionObserver: IntersectionObserver | null = null
    let handleMouseMove: ((e: MouseEvent) => void) | null = null

    try {
      // 1. WebGL Verification
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
      if (!gl) {
        setWebGlSupported(false)
        return
      }
      setWebGlSupported(true)

      // 2. Responsive Device Checks
      const isMobile = window.innerWidth < 768
      const maxDpr = isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2)

      // 3. Scene, Camera & Renderer
      const scene = new THREE.Scene()

      const width = container.clientWidth || 540
      const height = container.clientHeight || 540
      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100)
      camera.position.set(0, 0.6, 7.8)

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile,
        powerPreference: 'high-performance',
      })
      renderer.setSize(width, height)
      renderer.setPixelRatio(maxDpr)
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.1
      container.appendChild(renderer.domElement)

      // 4. Exact FestFlow Logo Color Materials
      // Cyan: #18CFFC, Blue: #07A4FC, Violet: #7F1AFB, Magenta: #ED47FC, Obsidian: #14141A
      const skinMaterial = new THREE.MeshStandardMaterial({
        color: 0xE8B490,
        roughness: 0.45,
        metalness: 0.05,
      })
      disposables.push(skinMaterial)

      const skinMaterial2 = new THREE.MeshStandardMaterial({
        color: 0xD89C76,
        roughness: 0.45,
        metalness: 0.05,
      })
      disposables.push(skinMaterial2)

      const obsidianHoodieMat = new THREE.MeshStandardMaterial({
        color: 0x14141C,
        roughness: 0.7,
        metalness: 0.2,
      })
      disposables.push(obsidianHoodieMat)

      const cyanAccentMat = new THREE.MeshStandardMaterial({
        color: 0x18CFFC,
        emissive: 0x18CFFC,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8,
      })
      disposables.push(cyanAccentMat)

      const electricBlueMat = new THREE.MeshStandardMaterial({
        color: 0x07A4FC,
        roughness: 0.35,
        metalness: 0.4,
      })
      disposables.push(electricBlueMat)

      const violetMat = new THREE.MeshStandardMaterial({
        color: 0x7F1AFB,
        emissive: 0x7F1AFB,
        emissiveIntensity: 0.4,
        roughness: 0.35,
        metalness: 0.5,
      })
      disposables.push(violetMat)

      const magentaJacketMat = new THREE.MeshStandardMaterial({
        color: 0xED47FC,
        emissive: 0xED47FC,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.3,
      })
      disposables.push(magentaJacketMat)

      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xE0E4EC,
        roughness: 0.1,
        metalness: 0.95,
      })
      disposables.push(chromeMat)

      const visorMat = new THREE.MeshPhysicalMaterial({
        color: 0x0A0A10,
        roughness: 0.1,
        metalness: 0.9,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.92,
      })
      disposables.push(visorMat)

      const glowingSoleMat = new THREE.MeshStandardMaterial({
        color: 0x18CFFC,
        emissive: 0x18CFFC,
        emissiveIntensity: 1.2,
        roughness: 0.2,
      })
      disposables.push(glowingSoleMat)

      // 5. Cinematic Lighting Rig matching logo emissions
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.4)
      scene.add(ambientLight)

      const frontKeyLight = new THREE.DirectionalLight(0xffffff, 2.5)
      frontKeyLight.position.set(1.5, 4.0, 5.5)
      scene.add(frontKeyLight)

      // Cyan rim light on the left
      const cyanRimLight = new THREE.PointLight(0x18CFFC, 36, 20)
      cyanRimLight.position.set(-4.5, 2.5, 2.5)
      scene.add(cyanRimLight)

      // Magenta/Violet rim light on the right
      const magentaRimLight = new THREE.PointLight(0xED47FC, 38, 20)
      magentaRimLight.position.set(4.5, 2.8, 1.5)
      scene.add(magentaRimLight)

      // Under-pedestal glow
      const floorBounce = new THREE.PointLight(0x7F1AFB, 22, 15)
      floorBounce.position.set(0, -2.5, 1.5)
      scene.add(floorBounce)

      // 6. Master Scene Group
      const masterGroup = new THREE.Group()
      scene.add(masterGroup)

      // ─────────────────────────────────────────────────────────────────────────
      // 7. FLOATING OBSIDIAN STAGE PEDESTAL
      // ─────────────────────────────────────────────────────────────────────────
      const pedestalGroup = new THREE.Group()
      pedestalGroup.position.set(0, -2.0, 0)
      masterGroup.add(pedestalGroup)

      // Base cylinder
      const pedestalGeo = new THREE.CylinderGeometry(2.8, 3.1, 0.45, isMobile ? 32 : 64)
      disposables.push(pedestalGeo)
      const pedestalMat = new THREE.MeshStandardMaterial({
        color: 0x0E0E14,
        roughness: 0.4,
        metalness: 0.85,
      })
      disposables.push(pedestalMat)
      const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat)
      pedestalGroup.add(pedestalMesh)

      // Outer Cyan Glowing Bezel Ring
      const ringCyanGeo = new THREE.TorusGeometry(2.82, 0.035, 16, isMobile ? 48 : 80)
      disposables.push(ringCyanGeo)
      const ringCyanMesh = new THREE.Mesh(ringCyanGeo, cyanAccentMat)
      ringCyanMesh.rotation.x = Math.PI / 2
      ringCyanMesh.position.y = 0.22
      pedestalGroup.add(ringCyanMesh)

      // Inner Magenta Glowing Ring
      const ringMagentaGeo = new THREE.TorusGeometry(2.35, 0.025, 16, isMobile ? 48 : 80)
      disposables.push(ringMagentaGeo)
      const ringMagentaMat = new THREE.MeshStandardMaterial({
        color: 0xED47FC,
        emissive: 0xED47FC,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
      disposables.push(ringMagentaMat)
      const ringMagentaMesh = new THREE.Mesh(ringMagentaGeo, ringMagentaMat)
      ringMagentaMesh.rotation.x = Math.PI / 2
      ringMagentaMesh.position.y = 0.225
      pedestalGroup.add(ringMagentaMesh)

      // ─────────────────────────────────────────────────────────────────────────
      // 8. CHARACTER 1: "The Campus Organizer / Club Lead" (Left)
      // ─────────────────────────────────────────────────────────────────────────
      const char1Group = new THREE.Group()
      char1Group.position.set(-1.15, -1.8, 0.1)
      char1Group.rotation.y = 0.28
      masterGroup.add(char1Group)

      // Torso / Hoodie
      const char1TorsoGeo = new THREE.CylinderGeometry(0.48, 0.42, 1.35, isMobile ? 18 : 28)
      disposables.push(char1TorsoGeo)
      const char1Torso = new THREE.Mesh(char1TorsoGeo, obsidianHoodieMat)
      char1Torso.position.y = 1.65
      char1Group.add(char1Torso)

      // Hoodie Chest Crest (FestFlow Cyan Band)
      const chestBandGeo = new THREE.CylinderGeometry(0.485, 0.482, 0.14, isMobile ? 18 : 28)
      disposables.push(chestBandGeo)
      const chestBand = new THREE.Mesh(chestBandGeo, cyanAccentMat)
      chestBand.position.y = 1.95
      char1Group.add(chestBand)

      // Head Group (for pointer tracking)
      const char1HeadGroup = new THREE.Group()
      char1HeadGroup.position.set(0, 2.58, 0)
      char1Group.add(char1HeadGroup)

      // Head Base
      const headGeo = new THREE.SphereGeometry(0.38, isMobile ? 20 : 32, isMobile ? 18 : 28)
      disposables.push(headGeo)
      const char1Head = new THREE.Mesh(headGeo, skinMaterial)
      char1HeadGroup.add(char1Head)

      // Futuristic Cyber Visor Glasses
      const visorGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.14, isMobile ? 16 : 24, 1, false, -Math.PI / 2.6, Math.PI / 1.3)
      disposables.push(visorGeo)
      const char1Visor = new THREE.Mesh(visorGeo, visorMat)
      char1Visor.position.set(0, 0.05, 0.05)
      char1HeadGroup.add(char1Visor)

      // Visor Cyan Edge Glow
      const visorGlowGeo = new THREE.BoxGeometry(0.55, 0.03, 0.12)
      disposables.push(visorGlowGeo)
      const char1VisorGlow = new THREE.Mesh(visorGlowGeo, cyanAccentMat)
      char1VisorGlow.position.set(0, 0.05, 0.38)
      char1HeadGroup.add(char1VisorGlow)

      // Studio Over-Ear Headphones Headband
      const headbandGeo = new THREE.TorusGeometry(0.41, 0.04, 12, 32, Math.PI)
      disposables.push(headbandGeo)
      const headband = new THREE.Mesh(headbandGeo, chromeMat)
      headband.position.set(0, 0.12, 0)
      char1HeadGroup.add(headband)

      // Headphone Ear Cups with Glowing Cyan Rings
      const earCupGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.10, 18)
      disposables.push(earCupGeo)
      const leftEarCup = new THREE.Mesh(earCupGeo, obsidianHoodieMat)
      leftEarCup.rotation.z = Math.PI / 2
      leftEarCup.position.set(-0.41, 0.05, 0)
      char1HeadGroup.add(leftEarCup)

      const leftEarRing = new THREE.Mesh(earCupGeo, cyanAccentMat)
      leftEarRing.scale.set(0.9, 0.2, 0.9)
      leftEarRing.rotation.z = Math.PI / 2
      leftEarRing.position.set(-0.45, 0.05, 0)
      char1HeadGroup.add(leftEarRing)

      const rightEarCup = new THREE.Mesh(earCupGeo, obsidianHoodieMat)
      rightEarCup.rotation.z = Math.PI / 2
      rightEarCup.position.set(0.41, 0.05, 0)
      char1HeadGroup.add(rightEarCup)

      const rightEarRing = new THREE.Mesh(earCupGeo, cyanAccentMat)
      rightEarRing.scale.set(0.9, 0.2, 0.9)
      rightEarRing.rotation.z = Math.PI / 2
      rightEarRing.position.set(0.45, 0.05, 0)
      char1HeadGroup.add(rightEarRing)

      // Arms: Left arm resting, Right arm holding Holographic Event Tablet
      const armGeo = new THREE.CapsuleGeometry(0.12, 0.55, 10, 16)
      disposables.push(armGeo)

      // Left Arm
      const char1LeftArm = new THREE.Mesh(armGeo, obsidianHoodieMat)
      char1LeftArm.position.set(-0.62, 1.6, 0.05)
      char1LeftArm.rotation.z = 0.25
      char1Group.add(char1LeftArm)

      // Right Arm (Forward holding tablet)
      const char1RightArm = new THREE.Mesh(armGeo, obsidianHoodieMat)
      char1RightArm.position.set(0.58, 1.55, 0.35)
      char1RightArm.rotation.x = -Math.PI / 4
      char1RightArm.rotation.z = -0.3
      char1Group.add(char1RightArm)

      // Holographic Event Tablet
      const tabletGeo = new THREE.BoxGeometry(0.55, 0.75, 0.035)
      disposables.push(tabletGeo)
      const tabletMat = new THREE.MeshStandardMaterial({
        color: 0x141422,
        roughness: 0.2,
        metalness: 0.9,
      })
      disposables.push(tabletMat)
      const tablet = new THREE.Mesh(tabletGeo, tabletMat)
      tablet.position.set(0.58, 1.72, 0.75)
      tablet.rotation.x = -Math.PI / 5
      tablet.rotation.y = -0.2
      char1Group.add(tablet)

      // Glowing Tablet Screen (Cyan/Violet Interface)
      const screenGeo = new THREE.PlaneGeometry(0.50, 0.68)
      disposables.push(screenGeo)
      const screenMat = new THREE.MeshBasicMaterial({
        color: 0x18CFFC,
        transparent: true,
        opacity: 0.85,
      })
      disposables.push(screenMat)
      const tabletScreen = new THREE.Mesh(screenGeo, screenMat)
      tabletScreen.position.z = 0.02
      tablet.add(tabletScreen)

      // Legs
      const legGeo = new THREE.CapsuleGeometry(0.16, 0.9, 10, 16)
      disposables.push(legGeo)
      const char1LeftLeg = new THREE.Mesh(legGeo, obsidianHoodieMat)
      char1LeftLeg.position.set(-0.25, 0.65, 0)
      char1Group.add(char1LeftLeg)

      const char1RightLeg = new THREE.Mesh(legGeo, obsidianHoodieMat)
      char1RightLeg.position.set(0.25, 0.65, 0)
      char1Group.add(char1RightLeg)

      // High-Top Cyber Sneakers with Cyan Soles
      const sneakerGeo = new THREE.BoxGeometry(0.32, 0.22, 0.55)
      disposables.push(sneakerGeo)
      const sneakerMat = new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.4 })
      disposables.push(sneakerMat)

      const char1LeftShoe = new THREE.Mesh(sneakerGeo, sneakerMat)
      char1LeftShoe.position.set(-0.25, 0.12, 0.1)
      char1Group.add(char1LeftShoe)

      const soleGeo = new THREE.BoxGeometry(0.33, 0.05, 0.56)
      disposables.push(soleGeo)
      const leftSole = new THREE.Mesh(soleGeo, glowingSoleMat)
      leftSole.position.set(0, -0.1, 0)
      char1LeftShoe.add(leftSole)

      const char1RightShoe = new THREE.Mesh(sneakerGeo, sneakerMat)
      char1RightShoe.position.set(0.25, 0.12, 0.1)
      char1Group.add(char1RightShoe)

      const rightSole = new THREE.Mesh(soleGeo, glowingSoleMat)
      rightSole.position.set(0, -0.1, 0)
      char1RightShoe.add(rightSole)

      // ─────────────────────────────────────────────────────────────────────────
      // 9. CHARACTER 2: "The Student Fest Attendee / Champion" (Right)
      // ─────────────────────────────────────────────────────────────────────────
      const char2Group = new THREE.Group()
      char2Group.position.set(1.15, -1.8, 0.1)
      char2Group.rotation.y = -0.32
      masterGroup.add(char2Group)

      // Varsity Bomber Jacket (Blue Body, Magenta Sleeves)
      const char2TorsoGeo = new THREE.CylinderGeometry(0.46, 0.40, 1.30, isMobile ? 18 : 28)
      disposables.push(char2TorsoGeo)
      const char2Torso = new THREE.Mesh(char2TorsoGeo, electricBlueMat)
      char2Torso.position.y = 1.62
      char2Group.add(char2Torso)

      // Varsity Chrome Snaps
      const snapGeo = new THREE.SphereGeometry(0.025, 8, 8)
      disposables.push(snapGeo)
      for (let s = 0; s < 4; s++) {
        const snap = new THREE.Mesh(snapGeo, chromeMat)
        snap.position.set(0, 1.45 + s * 0.16, 0.45)
        char2Group.add(snap)
      }

      // Head Group (for pointer tracking)
      const char2HeadGroup = new THREE.Group()
      char2HeadGroup.position.set(0, 2.52, 0)
      char2Group.add(char2HeadGroup)

      // Head Base
      const char2Head = new THREE.Mesh(headGeo, skinMaterial2)
      char2HeadGroup.add(char2Head)

      // Stylish Festival Cap
      const capGeo = new THREE.SphereGeometry(0.40, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.9)
      disposables.push(capGeo)
      const capMesh = new THREE.Mesh(capGeo, violetMat)
      capMesh.position.set(0, 0.08, -0.02)
      char2HeadGroup.add(capMesh)

      // Cap Brim
      const brimGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 18, 1, false, -Math.PI / 3, Math.PI / 1.5)
      disposables.push(brimGeo)
      const brimMesh = new THREE.Mesh(brimGeo, violetMat)
      brimMesh.position.set(0, 0.06, 0.32)
      char2HeadGroup.add(brimMesh)

      // FestFlow "F" Emblem on Cap
      const capEmblemGeo = new THREE.BoxGeometry(0.12, 0.12, 0.02)
      disposables.push(capEmblemGeo)
      const capEmblem = new THREE.Mesh(capEmblemGeo, cyanAccentMat)
      capEmblem.position.set(0, 0.22, 0.38)
      char2HeadGroup.add(capEmblem)

      // VIP Lanyard with Swinging Festival Pass
      const lanyardGeo = new THREE.TorusGeometry(0.28, 0.018, 8, 24, Math.PI)
      disposables.push(lanyardGeo)
      const lanyardMat = new THREE.MeshStandardMaterial({ color: 0x7F1AFB, roughness: 0.6 })
      disposables.push(lanyardMat)
      const lanyard = new THREE.Mesh(lanyardGeo, lanyardMat)
      lanyard.rotation.x = Math.PI / 2.3
      lanyard.position.set(0, 2.15, 0.25)
      char2Group.add(lanyard)

      // Mini VIP Pass hanging from lanyard
      const miniPassGeo = new THREE.BoxGeometry(0.24, 0.36, 0.015)
      disposables.push(miniPassGeo)
      const miniPassMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        emissive: 0xED47FC,
        emissiveIntensity: 0.6,
      })
      disposables.push(miniPassMat)
      const miniPass = new THREE.Mesh(miniPassGeo, miniPassMat)
      miniPass.position.set(0, 1.82, 0.48)
      char2Group.add(miniPass)

      // Arms: Left arm resting casually, Right arm enthusiastically raised in celebratory gesture
      const char2LeftArm = new THREE.Mesh(armGeo, magentaJacketMat)
      char2LeftArm.position.set(-0.58, 1.55, 0.1)
      char2LeftArm.rotation.z = 0.2
      char2Group.add(char2LeftArm)

      // Celebratory Raised Right Arm
      const char2RightArm = new THREE.Mesh(armGeo, magentaJacketMat)
      char2RightArm.position.set(0.62, 1.95, 0.15)
      char2RightArm.rotation.z = -Math.PI / 2.6
      char2RightArm.rotation.x = 0.3
      char2Group.add(char2RightArm)

      // Cyan Glowing Event Wristband on raised wrist
      const wristbandGeo = new THREE.TorusGeometry(0.13, 0.03, 12, 24)
      disposables.push(wristbandGeo)
      const wristband = new THREE.Mesh(wristbandGeo, cyanAccentMat)
      wristband.position.set(0.92, 2.32, 0.22)
      wristband.rotation.y = Math.PI / 3
      char2Group.add(wristband)

      // Hand gesture
      const handGeo = new THREE.SphereGeometry(0.11, 12, 12)
      disposables.push(handGeo)
      const handMesh = new THREE.Mesh(handGeo, skinMaterial2)
      handMesh.position.set(1.05, 2.45, 0.25)
      char2Group.add(handMesh)

      // Legs
      const char2LeftLeg = new THREE.Mesh(legGeo, obsidianHoodieMat)
      char2LeftLeg.position.set(-0.24, 0.65, 0)
      char2Group.add(char2LeftLeg)

      const char2RightLeg = new THREE.Mesh(legGeo, obsidianHoodieMat)
      char2RightLeg.position.set(0.24, 0.65, 0)
      char2Group.add(char2RightLeg)

      // Chunky Runners with Magenta Accent
      const char2ShoeMat = new THREE.MeshStandardMaterial({
        color: 0x1A1A26,
        roughness: 0.35,
      })
      disposables.push(char2ShoeMat)
      const magentaSoleMat = new THREE.MeshStandardMaterial({
        color: 0xED47FC,
        emissive: 0xED47FC,
        emissiveIntensity: 1.1,
      })
      disposables.push(magentaSoleMat)

      const char2LeftShoe = new THREE.Mesh(sneakerGeo, char2ShoeMat)
      char2LeftShoe.position.set(-0.24, 0.12, 0.1)
      char2Group.add(char2LeftShoe)
      const char2LeftSole = new THREE.Mesh(soleGeo, magentaSoleMat)
      char2LeftSole.position.set(0, -0.1, 0)
      char2LeftShoe.add(char2LeftSole)

      const char2RightShoe = new THREE.Mesh(sneakerGeo, char2ShoeMat)
      char2RightShoe.position.set(0.24, 0.12, 0.1)
      char2Group.add(char2RightShoe)
      const char2RightSole = new THREE.Mesh(soleGeo, magentaSoleMat)
      char2RightSole.position.set(0, -0.1, 0)
      char2RightShoe.add(char2RightSole)

      // ─────────────────────────────────────────────────────────────────────────
      // 10. CENTRAL FLOATING HOLOGRAPHIC FESTIVAL PASS
      // ─────────────────────────────────────────────────────────────────────────
      const passTexture = createFestivalPassTexture()
      disposables.push(passTexture)

      const floatingPassGeo = new THREE.BoxGeometry(1.35, 2.0, 0.04)
      disposables.push(floatingPassGeo)

      const passFrontMat = new THREE.MeshStandardMaterial({
        map: passTexture,
        roughness: 0.2,
        metalness: 0.1,
        emissive: 0x18CFFC,
        emissiveIntensity: 0.2,
      })
      disposables.push(passFrontMat)

      const passBackMat = new THREE.MeshStandardMaterial({
        color: 0x0E0E18,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0x7F1AFB,
        emissiveIntensity: 0.25,
      })
      disposables.push(passBackMat)

      const passEdgeMat = new THREE.MeshStandardMaterial({
        color: 0x18CFFC,
        emissive: 0x18CFFC,
        emissiveIntensity: 0.8,
      })
      disposables.push(passEdgeMat)

      const floatingPass = new THREE.Mesh(floatingPassGeo, [
        passEdgeMat,
        passEdgeMat,
        passEdgeMat,
        passEdgeMat,
        passFrontMat,
        passBackMat,
      ])
      floatingPass.position.set(0, 0.35, 1.25)
      masterGroup.add(floatingPass)

      // Glowing Hologram Halo Ring around floating pass
      const haloGeo = new THREE.TorusGeometry(1.4, 0.015, 12, 48)
      disposables.push(haloGeo)
      const haloMat = new THREE.MeshStandardMaterial({
        color: 0x18CFFC,
        emissive: 0x18CFFC,
        emissiveIntensity: 1.2,
      })
      disposables.push(haloMat)
      const haloMesh = new THREE.Mesh(haloGeo, haloMat)
      haloMesh.rotation.x = Math.PI / 2.8
      floatingPass.add(haloMesh)

      // ─────────────────────────────────────────────────────────────────────────
      // 11. ORBITING CELEBRATION EMBERS & GLYPHS
      // ─────────────────────────────────────────────────────────────────────────
      const sparkGeo = new THREE.OctahedronGeometry(0.08, 0)
      disposables.push(sparkGeo)
      const sparkMats = [
        new THREE.MeshStandardMaterial({ color: 0x18CFFC, emissive: 0x18CFFC, emissiveIntensity: 1.4 }),
        new THREE.MeshStandardMaterial({ color: 0xED47FC, emissive: 0xED47FC, emissiveIntensity: 1.4 }),
        new THREE.MeshStandardMaterial({ color: 0x7F1AFB, emissive: 0x7F1AFB, emissiveIntensity: 1.4 }),
      ]
      sparkMats.forEach((m) => disposables.push(m))

      const sparks: Array<{ mesh: THREE.Mesh; speed: number; radius: number; phase: number; yBase: number }> = []
      const sparkCount = isMobile ? 8 : 16
      for (let i = 0; i < sparkCount; i++) {
        const mat = sparkMats[i % sparkMats.length]
        const spark = new THREE.Mesh(sparkGeo, mat)
        const radius = 1.8 + (i % 4) * 0.45
        const phase = (i / sparkCount) * Math.PI * 2
        const yBase = -0.5 + (i % 5) * 0.6
        spark.position.set(Math.cos(phase) * radius, yBase, Math.sin(phase) * radius)
        masterGroup.add(spark)
        sparks.push({ mesh: spark, speed: 0.6 + (i % 3) * 0.25, radius, phase, yBase })
      }

      // ─────────────────────────────────────────────────────────────────────────
      // 12. INTERACTIVE POINTER TRACKING & ANIMATION LOOP
      // ─────────────────────────────────────────────────────────────────────────
      let mouseX = 0
      let mouseY = 0
      let targetRotY = 0
      let targetRotX = 0

      handleMouseMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect()
        mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      }
      window.addEventListener('mousemove', handleMouseMove, { passive: true })

      let isVisible = true
      intersectionObserver = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting
      }, { threshold: 0.1 })
      intersectionObserver.observe(container)

      const clock = new THREE.Clock()

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate)

        if (!isVisible || !renderer) return

        const elapsedTime = clock.getElapsedTime()

        // Natural Idle Breathing Motion
        if (!reducedMotion) {
          // Character 1 breathing and head micro-tilt
          char1Torso.scale.y = 1 + Math.sin(elapsedTime * 2.2) * 0.015
          char1Group.position.y = -1.8 + Math.sin(elapsedTime * 1.5) * 0.035

          // Character 2 breathing and celebratory arm bobbing
          char2Torso.scale.y = 1 + Math.sin(elapsedTime * 2.4 + 0.5) * 0.015
          char2Group.position.y = -1.8 + Math.sin(elapsedTime * 1.5 + 0.8) * 0.035
          char2RightArm.rotation.z = -Math.PI / 2.6 + Math.sin(elapsedTime * 3) * 0.06

          // Floating VIP pass gentle tumble and hover
          floatingPass.position.y = 0.35 + Math.sin(elapsedTime * 1.8) * 0.12
          floatingPass.rotation.y = Math.sin(elapsedTime * 0.8) * 0.25
          floatingPass.rotation.x = Math.cos(elapsedTime * 1.2) * 0.08

          // Floating pedestal hover
          pedestalGroup.position.y = -2.0 + Math.sin(elapsedTime * 1.2) * 0.03

          // Orbiting sparks
          sparks.forEach((sp, idx) => {
            const angle = sp.phase + elapsedTime * sp.speed * 0.4
            sp.mesh.position.x = Math.cos(angle) * sp.radius
            sp.mesh.position.z = Math.sin(angle) * sp.radius
            sp.mesh.position.y = sp.yBase + Math.sin(elapsedTime * 2 + idx) * 0.18
            sp.mesh.rotation.x += 0.02
            sp.mesh.rotation.y += 0.03
          })

          // Smooth Pointer Lerp for characters looking at user cursor
          targetRotY = mouseX * 0.28
          targetRotX = mouseY * 0.16

          char1HeadGroup.rotation.y += (targetRotY * 1.2 - char1HeadGroup.rotation.y) * 0.06
          char1HeadGroup.rotation.x += (-targetRotX * 0.8 - char1HeadGroup.rotation.x) * 0.06

          char2HeadGroup.rotation.y += (targetRotY * 1.2 - char2HeadGroup.rotation.y) * 0.06
          char2HeadGroup.rotation.x += (-targetRotX * 0.8 - char2HeadGroup.rotation.x) * 0.06

          masterGroup.rotation.y += (targetRotY * 0.35 - masterGroup.rotation.y) * 0.04
        }

        renderer.render(scene, camera)
      }

      animate()

      // ─────────────────────────────────────────────────────────────────────────
      // 13. RESPONSIVE RESIZE OBSERVER
      // ─────────────────────────────────────────────────────────────────────────
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = entry.contentRect.width
          const newHeight = entry.contentRect.height
          if (newWidth > 0 && newHeight > 0 && renderer) {
            camera.aspect = newWidth / newHeight
            // Responsive mobile camera distance
            if (newWidth < 640) {
              camera.position.set(0, 0.4, 9.2)
            } else if (newWidth < 1024) {
              camera.position.set(0, 0.5, 8.4)
            } else {
              camera.position.set(0, 0.6, 7.8)
            }
            camera.updateProjectionMatrix()
            renderer.setSize(newWidth, newHeight)
          }
        }
      })
      resizeObserver.observe(container)

    } catch (err) {
      console.warn('[FestFlow 3D] Failed to initialize character scene:', err)
      setWebGlSupported(false)
    }

    // Cleanup on unmount
    return () => {
      if (animationFrameId !== null) cancelAnimationFrame(animationFrameId)
      if (handleMouseMove) window.removeEventListener('mousemove', handleMouseMove)
      if (resizeObserver) resizeObserver.disconnect()
      if (intersectionObserver) intersectionObserver.disconnect()

      disposables.forEach((item) => {
        try {
          item.dispose()
        } catch {
          // ignore
        }
      })

      if (renderer && renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
        renderer.dispose()
      }
    }
  }, [reducedMotion])

  if (webGlSupported === false) {
    return <CharacterDuoFallback />
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[460px] sm:h-[520px] lg:h-[580px] flex items-center justify-center select-none"
      aria-label="Interactive 3D FestFlow Campus Characters"
    />
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class HeroScene3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[FestFlow 3D ErrorBoundary] Caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <CharacterDuoFallback />
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
