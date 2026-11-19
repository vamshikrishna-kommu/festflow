import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface StoryCanvasProps {
  currentScene: number // 0 to 6
  progress: number // 0 to 1
  isAutoPlaying: boolean
  onSceneChange?: (scene: number) => void
}

// Brand color palette constants
const PALETTE = {
  cyan: 0x18cffc,
  blue: 0x07a4fc,
  navy: 0x0d56fb,
  violet: 0x7f1afb,
  magenta: 0xed47fc,
  obsidian: 0x08080a,
  surface: 0x0e0e14,
  panelBorder: 0x222634,
  white: 0xffffff,
  gold: 0xf59e0b,
  emerald: 0x10b981,
}

// Camera choreography waypoints for each of the 7 scenes
interface CameraWaypoint {
  pos: [number, number, number]
  target: [number, number, number]
  fov: number
}

const WAYPOINTS: CameraWaypoint[] = [
  // Scene 1: Isometric Campus Overview (High angle looking down at the university layout)
  { pos: [14, 16, 18], target: [0, 1, 0], fov: 38 },
  // Scene 2: Discover Events (Glides close to frame the floating smartphone)
  { pos: [0, 2.2, 7.5], target: [0, 1.2, 0], fov: 42 },
  // Scene 3: Seat Selection (Tilts down into the glowing auditorium seating amphitheater)
  { pos: [-4, 6, 9], target: [-0.5, 0.5, -1], fov: 40 },
  // Scene 4: Registration & Manual UPI Payment (Dynamic 3/4 angle on phone)
  { pos: [2.5, 2.0, 6.8], target: [0.2, 1.0, 0], fov: 39 },
  // Scene 5: Digital Ticket 3D Presentation (Close-up dynamic perspective on the holographic pass)
  { pos: [0, 1.8, 5.8], target: [0, 1.2, 0], fov: 38 },
  // Scene 6: Club Command Center (Wide elevated perspective on the management command tablet)
  { pos: [0, 4.5, 8.2], target: [0, 0.8, -0.5], fov: 44 },
  // Scene 7: The Grand Final Reveal (Low angle epic hero shot embracing campus, devices, and spatial typography)
  { pos: [0, 5.5, 14], target: [0, 2.0, 0], fov: 46 },
]

export function CinematicStoryCanvas({
  currentScene,
  progress,
}: StoryCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [webGlSupported, setWebGlSupported] = useState<boolean | null>(null)
  const sceneRef = useRef(currentScene)
  const progressRef = useRef(progress)

  useEffect(() => {
    sceneRef.current = currentScene
  }, [currentScene])

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Verify WebGL availability
    const testCanvas = document.createElement('canvas')
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl')
    if (!gl) {
      setWebGlSupported(false)
      return
    }
    setWebGlSupported(true)

    // Three.js Scene Setup
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x08080a, 0.035)

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120)
    camera.position.set(...WAYPOINTS[0].pos)
    const currentTarget = new THREE.Vector3(...WAYPOINTS[0].target)
    camera.lookAt(currentTarget)

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    container.appendChild(renderer.domElement)

    // ─────────────────────────────────────────────────────────────────────────
    // LIGHTING RIG
    // ─────────────────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65)
    scene.add(ambientLight)

    // Key directional light casting soft shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8)
    keyLight.position.set(12, 22, 14)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    keyLight.shadow.camera.near = 1
    keyLight.shadow.camera.far = 50
    keyLight.shadow.bias = -0.0005
    scene.add(keyLight)

    // Cyan Neon Accent Light (Campus & Venue)
    const cyanLight = new THREE.PointLight(PALETTE.cyan, 3.5, 25)
    cyanLight.position.set(0, 4, 0)
    scene.add(cyanLight)

    // Magenta Rim Light
    const magentaLight = new THREE.PointLight(PALETTE.magenta, 2.8, 20)
    magentaLight.position.set(-6, 3, -4)
    scene.add(magentaLight)

    // Violet Bottom Glow
    const violetLight = new THREE.PointLight(PALETTE.violet, 2.0, 18)
    violetLight.position.set(5, -1, 3)
    scene.add(violetLight)

    // Spotlight over central event venue
    const venueSpotlight = new THREE.SpotLight(PALETTE.cyan, 6.0, 30, Math.PI / 6, 0.4, 1.2)
    venueSpotlight.position.set(0, 14, 0)
    venueSpotlight.target.position.set(0, 0, 0)
    scene.add(venueSpotlight)
    scene.add(venueSpotlight.target)

    // ─────────────────────────────────────────────────────────────────────────
    // 1. ISOMETRIC 3D CAMPUS ENVIRONMENT
    // ─────────────────────────────────────────────────────────────────────────
    const campusGroup = new THREE.Group()
    campusGroup.name = 'campusGroup'
    scene.add(campusGroup)

    // Ground Plane with grid texture
    const groundGeo = new THREE.PlaneGeometry(60, 60, 32, 32)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0f,
      roughness: 0.85,
      metalness: 0.1,
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    campusGroup.add(ground)

    // Subtle isometric grid lines on ground
    const gridHelper = new THREE.GridHelper(50, 50, PALETTE.cyan, 0x1f2333)
    gridHelper.position.y = 0.02
    campusGroup.add(gridHelper)

    // Procedural Campus Buildings
    interface CampusBuildingConfig {
      x: number
      z: number
      w: number
      h: number
      d: number
      color: number
      roofType?: 'flat' | 'sloped' | 'dome'
      label?: string
    }

    const BUILDINGS: CampusBuildingConfig[] = [
      // Central Event Auditorium / Fest Arena
      { x: 0, z: 0, w: 4.5, h: 2.8, d: 5.5, color: 0x121422, roofType: 'sloped', label: 'Main Auditorium' },
      // Engineering & Tech Complex
      { x: -7, z: -3, w: 3.8, h: 4.2, d: 3.2, color: 0x0f121d, roofType: 'flat', label: 'Tech Block' },
      // Science & Innovation Labs
      { x: -6.5, z: 4.5, w: 3.5, h: 3.5, d: 4.0, color: 0x101320, roofType: 'flat', label: 'Innovation Labs' },
      // Student Activities Center & Clubs Hub
      { x: 6.8, z: -2.5, w: 4.0, h: 3.0, d: 3.6, color: 0x141624, roofType: 'flat', label: 'Clubs Hub' },
      // Cultural Arts & Media Pavilion
      { x: 6.2, z: 4.8, w: 3.6, h: 2.4, d: 3.8, color: 0x131728, roofType: 'dome', label: 'Cultural Pavilion' },
      // Open Quadrangle perimeter gates
      { x: -11, z: 1, w: 2.4, h: 2.0, d: 5.0, color: 0x0d0f1a, roofType: 'flat' },
      { x: 10.5, z: 1.5, w: 2.4, h: 2.2, d: 4.8, color: 0x0d0f1a, roofType: 'flat' },
    ]

    const buildingMeshes: THREE.Mesh[] = []

    BUILDINGS.forEach((b) => {
      const bGroup = new THREE.Group()
      bGroup.position.set(b.x, 0, b.z)

      // Building Body
      const bodyGeo = new THREE.BoxGeometry(b.w, b.h, b.d)
      const bodyMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.6,
        metalness: 0.3,
      })
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat)
      bodyMesh.position.y = b.h / 2
      bodyMesh.castShadow = true
      bodyMesh.receiveShadow = true
      bGroup.add(bodyMesh)
      buildingMeshes.push(bodyMesh)

      // Edge illumination lines
      const edgeGeo = new THREE.EdgesGeometry(bodyGeo)
      const edgeMat = new THREE.LineBasicMaterial({
        color: b.x === 0 && b.z === 0 ? PALETTE.cyan : 0x272c42,
        linewidth: 1,
      })
      const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat)
      edgeLines.position.copy(bodyMesh.position)
      bGroup.add(edgeLines)

      // Roof Treatment
      if (b.roofType === 'sloped') {
        const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.65, 1.2, 4)
        roofGeo.rotateY(Math.PI / 4)
        const roofMat = new THREE.MeshStandardMaterial({
          color: 0x182035,
          roughness: 0.4,
          metalness: 0.6,
        })
        const roof = new THREE.Mesh(roofGeo, roofMat)
        roof.position.y = b.h + 0.6
        roof.castShadow = true
        bGroup.add(roof)
      } else if (b.roofType === 'dome') {
        const domeGeo = new THREE.SphereGeometry(b.w * 0.42, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2)
        const domeMat = new THREE.MeshStandardMaterial({
          color: 0x1f1835,
          roughness: 0.3,
          metalness: 0.7,
        })
        const dome = new THREE.Mesh(domeGeo, domeMat)
        dome.position.y = b.h
        dome.castShadow = true
        bGroup.add(dome)
      }

      campusGroup.add(bGroup)
    })

    // Central Event Portal Beacon (Hovering over auditorium)
    const portalGroup = new THREE.Group()
    portalGroup.position.set(0, 3.8, 0)
    campusGroup.add(portalGroup)

    const portalRingGeo = new THREE.TorusGeometry(1.4, 0.04, 16, 64)
    const portalRingMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan })
    const portalRing1 = new THREE.Mesh(portalRingGeo, portalRingMat)
    portalRing1.rotation.x = Math.PI / 2
    portalGroup.add(portalRing1)

    const portalRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.03, 16, 64),
      new THREE.MeshBasicMaterial({ color: PALETTE.magenta })
    )
    portalRing2.rotation.x = Math.PI / 2
    portalGroup.add(portalRing2)

    // Vertical spotlight beam
    const beamGeo = new THREE.CylinderGeometry(0.1, 1.8, 8, 32, 1, true)
    const beamMat = new THREE.MeshBasicMaterial({
      color: PALETTE.cyan,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.position.y = 4
    portalGroup.add(beam)

    // ─────────────────────────────────────────────────────────────────────────
    // 2. FLOATING 3D SMARTPHONE DEVICE MOCKUP
    // ─────────────────────────────────────────────────────────────────────────
    const deviceGroup = new THREE.Group()
    deviceGroup.name = 'deviceGroup'
    deviceGroup.position.set(0, 1.3, 0)
    scene.add(deviceGroup)

    // Phone Dimensions (Modern flagship phone: 1.8m width, 3.7m height, 0.16m thickness)
    const phoneW = 1.9
    const phoneH = 3.8
    const phoneD = 0.14

    // Phone Body Frame
    const phoneBodyGeo = new THREE.BoxGeometry(phoneW, phoneH, phoneD)
    const phoneBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0c0c12,
      roughness: 0.25,
      metalness: 0.85,
    })
    const phoneBody = new THREE.Mesh(phoneBodyGeo, phoneBodyMat)
    phoneBody.castShadow = true
    phoneBody.receiveShadow = true
    deviceGroup.add(phoneBody)

    // Metallic Outer Rim Bezel
    const phoneRimMat = new THREE.MeshStandardMaterial({
      color: 0x1f2538,
      roughness: 0.15,
      metalness: 0.95,
    })
    const phoneRim = new THREE.Mesh(
      new THREE.BoxGeometry(phoneW + 0.05, phoneH + 0.05, phoneD * 0.9),
      phoneRimMat
    )
    deviceGroup.add(phoneRim)

    // Screen Glass Surface
    const screenGeo = new THREE.PlaneGeometry(phoneW - 0.12, phoneH - 0.16)
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x090a10,
      roughness: 0.2,
      metalness: 0.1,
    })
    const screenMesh = new THREE.Mesh(screenGeo, screenMat)
    screenMesh.position.z = phoneD / 2 + 0.002
    deviceGroup.add(screenMesh)

    // Dynamic Island pill
    const notchGeo = new THREE.CapsuleGeometry(0.045, 0.26, 8, 16)
    notchGeo.rotateZ(Math.PI / 2)
    const notchMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const notch = new THREE.Mesh(notchGeo, notchMat)
    notch.position.set(0, phoneH / 2 - 0.24, phoneD / 2 + 0.004)
    deviceGroup.add(notch)

    // Cyan Neon Edge Glow along phone borders
    const phoneEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(phoneBodyGeo),
      new THREE.LineBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.65 })
    )
    deviceGroup.add(phoneEdges)

    // ─────────────────────────────────────────────────────────────────────────
    // 3. 3D AUDITORIUM & RESERVED SEATS GRID (Scene 3)
    // ─────────────────────────────────────────────────────────────────────────
    const auditoriumGroup = new THREE.Group()
    auditoriumGroup.name = 'auditoriumGroup'
    auditoriumGroup.position.set(-0.5, 0.6, -1.5)
    scene.add(auditoriumGroup)

    const seatsList: Array<{ mesh: THREE.Mesh; row: string; num: number; isSelected: boolean }> = []
    const rows = ['A', 'B', 'C', 'D']
    const cols = 8

    rows.forEach((row, rIdx) => {
      const radius = 3.6 + rIdx * 0.75
      const yOffset = rIdx * 0.28

      for (let c = 0; c < cols; c++) {
        const angle = -Math.PI / 3.2 + (c / (cols - 1)) * (Math.PI / 1.6)
        const x = Math.sin(angle) * radius
        const z = -Math.cos(angle) * radius + 3.0

        const isSelected = (row === 'A' && (c === 3 || c === 4))
        const isOccupied = (row === 'B' && c === 2) || (row === 'C' && c === 5)

        const seatColor = isSelected ? PALETTE.cyan : isOccupied ? 0x374151 : PALETTE.violet

        const seatGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32)
        const seatMat = new THREE.MeshStandardMaterial({
          color: seatColor,
          roughness: 0.4,
          metalness: 0.5,
        })
        const seatMesh = new THREE.Mesh(seatGeo, seatMat)
        seatMesh.position.set(x, yOffset, z)
        seatMesh.castShadow = true
        seatMesh.receiveShadow = true
        auditoriumGroup.add(seatMesh)

        seatsList.push({ mesh: seatMesh, row, num: c + 1, isSelected })
      }
    })

    // Stage Platform in Auditorium
    const stageGeo = new THREE.BoxGeometry(4.8, 0.3, 1.8)
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x161a29, roughness: 0.3, metalness: 0.6 })
    const stageMesh = new THREE.Mesh(stageGeo, stageMat)
    stageMesh.position.set(0, 0, -1.2)
    stageMesh.receiveShadow = true
    auditoriumGroup.add(stageMesh)

    // Stage front neon strip
    const stageLightStrip = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 0.06, 0.04),
      new THREE.MeshBasicMaterial({ color: PALETTE.magenta })
    )
    stageLightStrip.position.set(0, 0.15, -0.28)
    auditoriumGroup.add(stageLightStrip)

    // ─────────────────────────────────────────────────────────────────────────
    // 4. FLOATING 3D HOLOGRAPHIC TICKET (Scene 5)
    // ─────────────────────────────────────────────────────────────────────────
    const ticketGroup = new THREE.Group()
    ticketGroup.name = 'ticketGroup'
    ticketGroup.position.set(0, 1.4, 0.6)
    scene.add(ticketGroup)

    const ticketGeo = new THREE.BoxGeometry(2.1, 3.4, 0.04)
    const ticketMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f111a,
      roughness: 0.18,
      metalness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
    })
    const ticketMesh = new THREE.Mesh(ticketGeo, ticketMat)
    ticketMesh.castShadow = true
    ticketGroup.add(ticketMesh)

    // Glowing Neon Hologram Border on Ticket
    const ticketBorder = new THREE.LineSegments(
      new THREE.EdgesGeometry(ticketGeo),
      new THREE.LineBasicMaterial({ color: PALETTE.cyan, linewidth: 2 })
    )
    ticketGroup.add(ticketBorder)

    // Simulated QR Code Texture Plane on ticket
    const qrCanvas = document.createElement('canvas')
    qrCanvas.width = 256
    qrCanvas.height = 256
    const qrCtx = qrCanvas.getContext('2d')
    if (qrCtx) {
      qrCtx.fillStyle = '#0f111a'
      qrCtx.fillRect(0, 0, 256, 256)
      qrCtx.fillStyle = '#18CFFC'
      // Draw simulated authentic QR matrix
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 7; c++) {
          if ((r === 0 || r === 6 || c === 0 || c === 6) && (r < 7 && c < 7)) {
            qrCtx.fillRect(20 + c * 10, 20 + r * 10, 8, 8)
            qrCtx.fillRect(160 + c * 10, 20 + r * 10, 8, 8)
            qrCtx.fillRect(20 + c * 10, 160 + r * 10, 8, 8)
          }
        }
      }
      for (let i = 0; i < 40; i++) {
        const x = 30 + Math.floor(Math.random() * 180)
        const y = 30 + Math.floor(Math.random() * 180)
        qrCtx.fillRect(x, y, 7, 7)
      }
    }
    const qrTexture = new THREE.CanvasTexture(qrCanvas)
    const qrPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.8),
      new THREE.MeshBasicMaterial({ map: qrTexture })
    )
    qrPlate.position.set(0, 0.4, 0.025)
    ticketGroup.add(qrPlate)

    // ─────────────────────────────────────────────────────────────────────────
    // 5. PARTICLE ATMOSPHERE (Floating Stars / Energy Sparks)
    // ─────────────────────────────────────────────────────────────────────────
    const particleCount = 180
    const particlePositions = new Float32Array(particleCount * 3)
    const particleColors = new Float32Array(particleCount * 3)

    const cyanCol = new THREE.Color(PALETTE.cyan)
    const magentaCol = new THREE.Color(PALETTE.magenta)

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 35
      particlePositions[i * 3 + 1] = Math.random() * 18 - 1
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 35

      const c = Math.random() > 0.5 ? cyanCol : magentaCol
      particleColors[i * 3] = c.r
      particleColors[i * 3 + 1] = c.g
      particleColors[i * 3 + 2] = c.b
    }

    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3))

    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    })
    const particleSystem = new THREE.Points(particleGeo, particleMat)
    scene.add(particleSystem)

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER & ANIMATION LOOP
    // ─────────────────────────────────────────────────────────────────────────
    let animationFrameId: number
    const clock = new THREE.Clock()

    const targetPos = new THREE.Vector3()
    const targetLook = new THREE.Vector3()

    function animate() {
      animationFrameId = requestAnimationFrame(animate)

      const elapsed = clock.getElapsedTime()

      // Calculate camera waypoint interpolation based on active scene and mobile framing
      const activeScene = sceneRef.current
      const currentWaypoint = WAYPOINTS[Math.min(activeScene, WAYPOINTS.length - 1)]
      const isMobile = window.innerWidth < 768
      targetPos.set(
        currentWaypoint.pos[0],
        currentWaypoint.pos[1],
        currentWaypoint.pos[2] + (isMobile ? 2.0 : 0)
      )
      targetLook.set(...currentWaypoint.target)

      // Smooth camera lerp for cinematic fluidity
      camera.position.lerp(targetPos, 0.055)
      currentTarget.lerp(targetLook, 0.055)
      camera.lookAt(currentTarget)

      // Idle rotations & floating physics per object
      portalRing1.rotation.z += 0.012
      portalRing2.rotation.z -= 0.018

      // Device floating motion
      deviceGroup.position.y = 1.3 + Math.sin(elapsed * 1.6) * 0.08
      deviceGroup.rotation.y = Math.sin(elapsed * 0.9) * 0.07

      // Ticket idle float
      ticketGroup.position.y = 1.4 + Math.sin(elapsed * 1.4 + 1.0) * 0.1
      ticketGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.12
      ticketGroup.rotation.z = Math.cos(elapsed * 1.1) * 0.03

      // Visibility toggles per scene to focus attention cleanly
      if (activeScene === 0) {
        // Scene 1: Campus is primary
        campusGroup.visible = true
        deviceGroup.visible = false
        auditoriumGroup.visible = false
        ticketGroup.visible = false
      } else if (activeScene === 1) {
        // Scene 2: Smartphone Discover
        campusGroup.visible = true
        deviceGroup.visible = true
        auditoriumGroup.visible = false
        ticketGroup.visible = false
      } else if (activeScene === 2) {
        // Scene 3: Seat selection
        campusGroup.visible = false
        deviceGroup.visible = false
        auditoriumGroup.visible = true
        ticketGroup.visible = false
      } else if (activeScene === 3) {
        // Scene 4: Registration & payment
        campusGroup.visible = true
        deviceGroup.visible = true
        auditoriumGroup.visible = false
        ticketGroup.visible = false
      } else if (activeScene === 4) {
        // Scene 5: Digital ticket
        campusGroup.visible = false
        deviceGroup.visible = false
        auditoriumGroup.visible = false
        ticketGroup.visible = true
      } else {
        // Scenes 6 & 7: Command center & Final reveal (all combined)
        campusGroup.visible = true
        deviceGroup.visible = true
        auditoriumGroup.visible = true
        ticketGroup.visible = true
      }

      // Selected seats pulsing
      seatsList.forEach((s, idx) => {
        if (s.isSelected) {
          s.mesh.position.y = (s.row.charCodeAt(0) - 65) * 0.28 + 0.12 + Math.sin(elapsed * 3.5 + idx) * 0.04
        }
      })

      // Particle gentle drift
      particleSystem.rotation.y = elapsed * 0.02

      renderer.render(scene, camera)
    }

    animate()

    // ─────────────────────────────────────────────────────────────────────────
    // RESPONSIVE RESIZE
    // ─────────────────────────────────────────────────────────────────────────
    const handleResize = () => {
      if (!container) return
      const newW = container.clientWidth
      const newH = container.clientHeight
      if (newW > 0 && newH > 0) {
        camera.aspect = newW / newH
        camera.updateProjectionMatrix()
        renderer.setSize(newW, newH)
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup & recursive resource disposal
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          ;(obj as THREE.Mesh).geometry.dispose()
        }
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
          else mat.dispose()
        }
      })
      if (renderer.domElement && renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement)
      }
      renderer.dispose()
    }
  }, [])

  if (webGlSupported === false) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#08080A]">
        <div className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 max-w-sm">
          <p className="text-sm font-semibold text-white">WebGL High-Performance Mode</p>
          <p className="text-xs text-zinc-400 mt-1">Accelerating product visualization...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden"
      aria-label="3D FestFlow Product Universe"
    />
  )
}
export default CinematicStoryCanvas
