import {
  useEffect,
  useRef,
  useState,
  useMemo,
  Component,
  type ReactNode,
} from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WebGLFallback } from './WebGLFallback'
import { CinematicCameraController } from './CinematicCameraController'

export interface InfiniteUniverseCanvasProps {
  scrollProgress?: number
  className?: string
  reducedMotion?: boolean
}

// Brand color palette
const PALETTE = {
  cyan: '#18CFFC',
  skyBlue: '#07A4FC',
  cobalt: '#0D56FB',
  violet: '#7F1AFB',
  magenta: '#ED47FC',
  obsidian: '#08080A',
}

// Check for WebGL capability safely in browser
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl && (gl instanceof WebGLRenderingContext || (window.WebGL2RenderingContext && gl instanceof WebGL2RenderingContext)))
  } catch {
    return false
  }
}

// WebGL Error Boundary to catch R3F or GPU context crash
interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

export class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown) {
    console.warn('[InfiniteUniverseCanvas] WebGL context error caught by boundary:', error)
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// ==========================================
// 1. Constellation Field (Cyan & Violet Glowing Points)
// ==========================================
function ConstellationField({
  scrollProgress,
  reducedMotion,
}: {
  scrollProgress: number
  reducedMotion: boolean
}) {
  const pointsRef = useRef<THREE.Points | null>(null)
  const count = 1400

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const colorPalette = [
      new THREE.Color(PALETTE.cyan),
      new THREE.Color(PALETTE.skyBlue),
      new THREE.Color(PALETTE.violet),
      new THREE.Color(PALETTE.magenta),
    ]

    for (let i = 0; i < count; i++) {
      // Cylinder distribution with cosmic radius
      const r = 4 + Math.random() * 26
      const theta = Math.random() * Math.PI * 2
      const y = (Math.random() - 0.5) * 32

      pos[i * 3] = r * Math.cos(theta)
      pos[i * 3 + 1] = y
      pos[i * 3 + 2] = r * Math.sin(theta)

      const c = colorPalette[Math.floor(Math.random() * colorPalette.length)]
      col[i * 3] = c.r
      col[i * 3 + 1] = c.g
      col[i * 3 + 2] = c.b
    }

    return [pos, col]
  }, [count])

  useFrame((_, delta) => {
    if (!pointsRef.current) return
    const rotSpeed = reducedMotion ? 0.01 : 0.035
    pointsRef.current.rotation.y += delta * rotSpeed
    pointsRef.current.rotation.x = Math.sin(scrollProgress * Math.PI) * 0.12
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// ==========================================
// 2. Central Floating Brand Monolith with Morphing Geometry
// ==========================================
function CentralBrandMonolith({
  scrollProgress,
  reducedMotion,
}: {
  scrollProgress: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group | null>(null)
  const coreRef = useRef<THREE.Mesh | null>(null)
  const ring1Ref = useRef<THREE.Mesh | null>(null)
  const ring2Ref = useRef<THREE.Mesh | null>(null)

  useFrame((state) => {
    if (!groupRef.current) return
    const time = state.clock.getElapsedTime()
    const rotSpeed = reducedMotion ? 0.2 : 0.6

    // Floating vertical oscillation
    groupRef.current.position.y = 0.5 + Math.sin(time * 0.8) * 0.2

    // Progressive rotation with scroll scrub
    groupRef.current.rotation.y = time * 0.15 * rotSpeed + scrollProgress * Math.PI * 2.5
    groupRef.current.rotation.z = Math.sin(time * 0.4) * 0.1

    if (coreRef.current) {
      // Core dynamic scale pulsing
      const pulse = 1.0 + Math.sin(time * 2.0) * 0.08
      coreRef.current.scale.set(pulse, pulse, pulse)
      coreRef.current.rotation.x = time * 0.4
    }

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = time * 0.3
      ring1Ref.current.rotation.y = time * 0.5
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.y = -time * 0.4
      ring2Ref.current.rotation.z = time * 0.2
    }
  })

  return (
    <group ref={groupRef} position={[0, 0.5, 0]}>
      {/* Outer faceted obsidian monolith shell */}
      <mesh castShadow receiveShadow>
        <octahedronGeometry args={[1.5, 0]} />
        <meshPhysicalMaterial
          color={PALETTE.obsidian}
          emissive={PALETTE.cobalt}
          emissiveIntensity={0.3 + scrollProgress * 0.4}
          roughness={0.15}
          metalness={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          wireframe={false}
        />
      </mesh>

      {/* Wireframe accent cage */}
      <mesh>
        <octahedronGeometry args={[1.52, 0]} />
        <meshBasicMaterial
          color={PALETTE.cyan}
          wireframe
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Inner glowing morphing core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.75, 1]} />
        <meshStandardMaterial
          color={PALETTE.cyan}
          emissive={PALETTE.cyan}
          emissiveIntensity={1.8}
          wireframe
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Orbital Energy Ring 1 - Cyan */}
      <mesh ref={ring1Ref} rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[2.4, 0.025, 16, 64]} />
        <meshBasicMaterial
          color={PALETTE.cyan}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Orbital Energy Ring 2 - Radiant Magenta */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 3, Math.PI / 6, 0]}>
        <torusGeometry args={[2.7, 0.02, 16, 64]} />
        <meshBasicMaterial
          color={PALETTE.magenta}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  )
}

// ==========================================
// 3. Low-Poly Architectural Campus Complex & Glass Pavilion
// ==========================================
function ArchitecturalCampus({
  scrollProgress,
}: {
  scrollProgress: number
}) {
  const campusRef = useRef<THREE.Group | null>(null)

  // Building layouts
  const buildings = useMemo(
    () => [
      // Central Glass Pavilion
      { pos: [0, -1.2, -3] as const, size: [3.8, 1.4, 3.8] as const, isGlass: true, color: PALETTE.skyBlue },
      // Engineering & Tech Tower (Left)
      { pos: [-4.2, 0.2, -4] as const, size: [1.8, 4.2, 1.8] as const, isGlass: false, color: PALETTE.cobalt },
      // Innovation Atrium (Right)
      { pos: [4.4, -0.2, -4.5] as const, size: [2.2, 3.4, 2.0] as const, isGlass: false, color: PALETTE.violet },
      // Cultural Auditorium Wing (Back)
      { pos: [0.8, -0.6, -7.0] as const, size: [5.2, 2.0, 2.5] as const, isGlass: false, color: PALETTE.cyan },
      // Student Forum Plaza Block
      { pos: [-2.2, -1.0, -1.8] as const, size: [1.6, 1.8, 1.6] as const, isGlass: false, color: PALETTE.obsidian },
      { pos: [2.4, -0.8, -2.0] as const, size: [1.8, 2.2, 1.4] as const, isGlass: false, color: PALETTE.obsidian },
    ],
    []
  )

  useFrame(() => {
    if (!campusRef.current) return
    // Campus visibility and emissive response to scroll progress
    campusRef.current.position.y = -0.5 + Math.sin(scrollProgress * Math.PI) * 0.15
  })

  return (
    <group ref={campusRef}>
      {/* Ground Grid lines representing campus pathways */}
      <gridHelper
        args={[36, 36, PALETTE.cyan, '#151520']}
        position={[0, -1.95, -4]}
      />

      {/* Buildings */}
      {buildings.map((b, idx) => (
        <group key={idx} position={b.pos}>
          {b.isGlass ? (
            // Glass Pavilion with translucent physical material
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[b.size[0] / 2, b.size[0] / 2, b.size[1], 8]} />
              <meshPhysicalMaterial
                color={b.color}
                transmission={0.8}
                transparent
                opacity={0.45}
                roughness={0.1}
                metalness={0.2}
                ior={1.4}
              />
            </mesh>
          ) : (
            // Low-poly structural building blocks with illuminated edges
            <mesh castShadow receiveShadow>
              <boxGeometry args={b.size} />
              <meshStandardMaterial
                color="#0c0e17"
                roughness={0.4}
                metalness={0.7}
              />
            </mesh>
          )}

          {/* Emissive Structural Wireframe Overlays */}
          <lineSegments>
            <edgesGeometry
              args={[
                b.isGlass
                  ? new THREE.CylinderGeometry(b.size[0] / 2, b.size[0] / 2, b.size[1], 8)
                  : new THREE.BoxGeometry(...b.size),
              ]}
            />
            <lineBasicMaterial
              color={b.isGlass ? PALETTE.cyan : PALETTE.skyBlue}
              transparent
              opacity={0.45 + (scrollProgress > 0.1 && scrollProgress < 0.35 ? 0.35 : 0)}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  )
}

// ==========================================
// 4. Interconnected University Nodes with Spline Arcs
// ==========================================
function UniversityNetworkArcs({
  scrollProgress,
}: {
  scrollProgress: number
}) {
  const pulsesRef = useRef<THREE.Group | null>(null)

  // University Node coordinates
  const nodes = useMemo(
    () => [
      { id: 'n1', pos: new THREE.Vector3(-4.5, 2.5, -2.0), label: 'IIT Madras' },
      { id: 'n2', pos: new THREE.Vector3(4.2, 1.8, -2.5), label: 'BITS Pilani' },
      { id: 'n3', pos: new THREE.Vector3(-3.0, -1.2, -4.0), label: 'NIT Trichy' },
      { id: 'n4', pos: new THREE.Vector3(3.5, -1.5, -3.5), label: 'VIT Vellore' },
      { id: 'n5', pos: new THREE.Vector3(0.0, 3.2, -3.5), label: 'IIT Bombay' },
      { id: 'n6', pos: new THREE.Vector3(-5.0, 0.0, -5.0), label: 'DTU Delhi' },
      { id: 'n7', pos: new THREE.Vector3(5.0, -0.5, -5.5), label: 'SRM University' },
      { id: 'n8', pos: new THREE.Vector3(0.0, -2.5, -4.5), label: 'IISc Bangalore' },
    ],
    []
  )

  // Generate cubic spline curves between neighboring university nodes
  const curves = useMemo(() => {
    const list: THREE.CatmullRomCurve3[] = []
    const connections: [number, number][] = [
      [0, 4],
      [4, 1],
      [1, 3],
      [3, 7],
      [7, 2],
      [2, 0],
      [0, 5],
      [1, 6],
      [2, 5],
      [3, 6],
    ]

    connections.forEach(([from, to]) => {
      const p1 = nodes[from].pos
      const p2 = nodes[to].pos
      // Midpoint arched upward or outward for a soaring 3D curve
      const mid = new THREE.Vector3()
        .addVectors(p1, p2)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 0.8 + Math.random() * 0.4, 0.5))

      list.push(new THREE.CatmullRomCurve3([p1, mid, p2]))
    })
    return list
  }, [nodes])

  // Network becomes brightest around World 8 (Connected Campus Network)
  const networkGlow = scrollProgress > 0.75 && scrollProgress < 0.95 ? 1.0 : 0.6

  // Line objects with proper disposal to prevent memory leaks
  const lineObjects = useMemo(() => {
    return curves.map((curve, idx) => {
      const points = curve.getPoints(32)
      const geom = new THREE.BufferGeometry().setFromPoints(points)
      const mat = new THREE.LineBasicMaterial({
        color: idx % 2 === 0 ? PALETTE.cyan : PALETTE.violet,
        transparent: true,
        opacity: 0.35 * networkGlow,
      })
      return new THREE.Line(geom, mat)
    })
  }, [curves, networkGlow])

  useEffect(() => {
    return () => {
      lineObjects.forEach((line) => {
        line.geometry.dispose()
        if (Array.isArray(line.material)) {
          line.material.forEach((m) => m.dispose())
        } else {
          line.material.dispose()
        }
      })
    }
  }, [lineObjects])

  useFrame((state) => {
    if (!pulsesRef.current) return
    const time = state.clock.getElapsedTime()
    const children = pulsesRef.current.children

    // Move packet pulses along each curve
    curves.forEach((curve, idx) => {
      const mesh = children[idx] as THREE.Mesh | undefined
      if (mesh) {
        const t = (time * 0.25 + idx * 0.12) % 1.0
        const pt = curve.getPointAt(t)
        mesh.position.copy(pt)
      }
    })
  })

  return (
    <group>
      {/* University Node Spheres */}
      {nodes.map((node) => (
        <group key={node.id} position={node.pos}>
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <meshStandardMaterial
              color={PALETTE.cyan}
              emissive={PALETTE.cyan}
              emissiveIntensity={1.5 * networkGlow}
            />
          </mesh>
          {/* Subtle outer pulse halo */}
          <mesh>
            <sphereGeometry args={[0.26, 12, 12]} />
            <meshBasicMaterial
              color={PALETTE.violet}
              transparent
              opacity={0.35 * networkGlow}
            />
          </mesh>
        </group>
      ))}

      {/* Spline Arcs */}
      {lineObjects.map((lineObj, idx) => (
        <primitive key={idx} object={lineObj} />
      ))}

      {/* Data Pulse Packets Traveling Along Arcs */}
      <group ref={pulsesRef}>
        {curves.map((_, idx) => (
          <mesh key={idx}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshBasicMaterial
              color={idx % 2 === 0 ? PALETTE.cyan : PALETTE.magenta}
            />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// Scene Root with Lights and Choreography
function UniverseScene({
  scrollProgress,
  reducedMotion,
}: {
  scrollProgress: number
  reducedMotion: boolean
}) {
  const { gl } = useThree()

  // Clean disposal on unmount
  useEffect(() => {
    return () => {
      try {
        gl.dispose()
      } catch {
        // Safe disposal
      }
    }
  }, [gl])

  return (
    <>
      {/* Camera choreography synced to scrollProgress */}
      <CinematicCameraController
        scrollProgress={scrollProgress}
        reducedMotion={reducedMotion}
      />

      {/* Cinematic Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 15, 8]}
        intensity={1.2}
        color="#ffffff"
      />
      <pointLight
        position={[0, 4, 2]}
        intensity={2.0}
        color={PALETTE.cyan}
        distance={20}
      />
      <pointLight
        position={[-6, -2, -4]}
        intensity={1.8}
        color={PALETTE.violet}
        distance={18}
      />
      <pointLight
        position={[6, 2, -5]}
        intensity={1.5}
        color={PALETTE.magenta}
        distance={18}
      />

      {/* 3D Visual Environments */}
      <ConstellationField
        scrollProgress={scrollProgress}
        reducedMotion={reducedMotion}
      />
      <CentralBrandMonolith
        scrollProgress={scrollProgress}
        reducedMotion={reducedMotion}
      />
      <ArchitecturalCampus scrollProgress={scrollProgress} />
      <UniversityNetworkArcs scrollProgress={scrollProgress} />
    </>
  )
}

// Master Canvas Component
export function InfiniteUniverseCanvas({
  scrollProgress = 0,
  className = '',
  reducedMotion = false,
}: InfiniteUniverseCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [webglSupported, setWebglSupported] = useState<boolean>(true)

  // Verify WebGL availability on mount
  useEffect(() => {
    setWebglSupported(isWebGLAvailable())
  }, [])

  // Pause rendering when off-screen to preserve battery and GPU cycles
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0.02 }
    )

    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])

  if (!webglSupported) {
    return (
      <div ref={containerRef} className={`fixed inset-0 pointer-events-none -z-10 ${className}`}>
        <WebGLFallback type="hero" reducedMotion={reducedMotion} />
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 pointer-events-none -z-10 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <WebGLErrorBoundary
        fallback={<WebGLFallback type="hero" reducedMotion={reducedMotion} />}
      >
        {isVisible && (
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 2, 10], fov: 45 }}
            gl={{
              powerPreference: 'high-performance',
              antialias: true,
              alpha: true,
            }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <UniverseScene
              scrollProgress={scrollProgress}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        )}
      </WebGLErrorBoundary>
    </div>
  )
}

export default InfiniteUniverseCanvas
