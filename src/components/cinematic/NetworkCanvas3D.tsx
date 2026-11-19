import { useEffect, useRef, useState, useMemo, Component, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WebGLFallback } from './WebGLFallback'

export interface NetworkCanvas3DProps {
  className?: string
  reducedMotion?: boolean
}

// WebGL support detector
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    return Boolean(gl && gl instanceof WebGLRenderingContext)
  } catch {
    return false
  }
}

// WebGL Error Boundary
interface ErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class WebGLErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override componentDidCatch(error: unknown) {
    console.warn('[NetworkCanvas3D] WebGL render error caught by boundary:', error)
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Campus Hub Node Definition
interface CampusNode {
  id: string
  name: string
  short: string
  position: [number, number, number]
  color: string
  size: number
}

const CAMPUS_NODES: CampusNode[] = [
  { id: '1', name: 'Alpha Tech Hub', short: 'ATH', position: [0, 0, 0], color: '#18CFFC', size: 0.45 },
  { id: '2', name: 'Metro Campus', short: 'MC', position: [-3.2, 1.8, 1.2], color: '#7F1AFB', size: 0.35 },
  { id: '3', name: 'Imperial Poly', short: 'IP', position: [3.4, 1.4, -1.0], color: '#18CFFC', size: 0.34 },
  { id: '4', name: 'National Institute', short: 'NI', position: [-2.8, -2.0, -1.5], color: '#07A4FC', size: 0.32 },
  { id: '5', name: 'Design Academy', short: 'DA', position: [2.6, -1.9, 1.6], color: '#ED47FC', size: 0.36 },
  { id: '6', name: 'Northern Research', short: 'NR', position: [-1.2, 3.2, -1.8], color: '#18CFFC', size: 0.30 },
  { id: '7', name: 'Southern Valley', short: 'SV', position: [1.5, 3.0, 1.4], color: '#7F1AFB', size: 0.31 },
  { id: '8', name: 'Cyber Institute', short: 'CI', position: [-4.2, -0.4, 0.5], color: '#0D56FB', size: 0.28 },
  { id: '9', name: 'BioTech Park', short: 'BTP', position: [4.0, -0.2, 0.4], color: '#18CFFC', size: 0.29 },
  { id: '10', name: 'Arts & Culture', short: 'AC', position: [0.2, -3.2, 0.8], color: '#ED47FC', size: 0.33 },
]

// Network Connections (indices in CAMPUS_NODES)
const NETWORK_CONNECTIONS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [0, 4],
  [0, 6],
  [0, 9],
  [1, 5],
  [1, 7],
  [2, 6],
  [2, 8],
  [3, 7],
  [3, 9],
  [4, 8],
  [4, 9],
  [5, 6],
  [7, 1],
]

// Spline Arcs and Moving Data Packets
function NetworkConnectionsAndPackets({
  reducedMotion,
}: {
  reducedMotion: boolean
}) {
  const packetMeshesRef = useRef<(THREE.Mesh | null)[]>([])

  // Build quadratic bezier curves for curved high-tech pathways
  const { curves, cyanGeom, violetGeom, cyanMat, violetMat } = useMemo(() => {
    const curveList: THREE.QuadraticBezierCurve3[] = []
    const cyanPoints: THREE.Vector3[] = []
    const violetPoints: THREE.Vector3[] = []

    NETWORK_CONNECTIONS.forEach(([startIdx, endIdx], i) => {
      const p1 = new THREE.Vector3(...CAMPUS_NODES[startIdx].position)
      const p2 = new THREE.Vector3(...CAMPUS_NODES[endIdx].position)

      // Arched midpoint control vector
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
      const normal = mid.clone().normalize().multiplyScalar(0.8)
      mid.add(normal)

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      curveList.push(curve)

      const points = curve.getPoints(24)
      const targetPoints = i % 2 === 0 ? cyanPoints : violetPoints
      for (let j = 0; j < points.length - 1; j++) {
        targetPoints.push(points[j], points[j + 1])
      }
    })

    const cGeom = new THREE.BufferGeometry().setFromPoints(cyanPoints)
    const vGeom = new THREE.BufferGeometry().setFromPoints(violetPoints)

    const cMat = new THREE.LineBasicMaterial({
      color: '#18CFFC',
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    })

    const vMat = new THREE.LineBasicMaterial({
      color: '#7F1AFB',
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    })

    return {
      curves: curveList,
      cyanGeom: cGeom,
      violetGeom: vGeom,
      cyanMat: cMat,
      violetMat: vMat,
    }
  }, [])

  // Packet geometries & materials
  const packetGeometry = useMemo(() => new THREE.SphereGeometry(0.08, 12, 12), [])
  const packetCyanMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#18CFFC',
        transparent: true,
        opacity: 0.95,
      }),
    []
  )
  const packetVioletMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ED47FC',
        transparent: true,
        opacity: 0.95,
      }),
    []
  )

  // Disposal on unmount
  useEffect(() => {
    return () => {
      cyanGeom.dispose()
      violetGeom.dispose()
      cyanMat.dispose()
      violetMat.dispose()
      packetGeometry.dispose()
      packetCyanMat.dispose()
      packetVioletMat.dispose()
    }
  }, [cyanGeom, violetGeom, cyanMat, violetMat, packetGeometry, packetCyanMat, packetVioletMat])

  // Animate packets along spline paths
  useFrame((state) => {
    if (reducedMotion) return
    const time = state.clock.getElapsedTime()

    curves.forEach((curve, i) => {
      const mesh = packetMeshesRef.current[i]
      if (!mesh) return

      // Different speeds and phase offsets per connection
      const speed = 0.22 + (i % 5) * 0.05
      const offset = (i * 0.17) % 1
      const progress = (time * speed + offset) % 1

      const pos = curve.getPoint(progress)
      mesh.position.copy(pos)

      // Subtle scale pulsation
      const s = 0.8 + 0.4 * Math.sin(time * 5 + i)
      mesh.scale.set(s, s, s)
    })
  })

  return (
    <group>
      {/* Arced Spline Lines */}
      <lineSegments geometry={cyanGeom} material={cyanMat} />
      <lineSegments geometry={violetGeom} material={violetMat} />

      {/* Pulsing Data Packets */}
      {curves.map((_, i) => (
        <mesh
          key={`packet-${i}`}
          ref={(el) => {
            packetMeshesRef.current[i] = el
          }}
          geometry={packetGeometry}
          material={i % 2 === 0 ? packetCyanMat : packetVioletMat}
        />
      ))}
    </group>
  )
}

// Glowing Campus Nodes
function CampusNodes({ reducedMotion }: { reducedMotion: boolean }) {
  const nodeHaloRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame((state) => {
    if (reducedMotion) return
    const time = state.clock.getElapsedTime()

    nodeHaloRefs.current.forEach((halo, i) => {
      if (!halo) return
      halo.rotation.z = time * 0.4 * (i % 2 === 0 ? 1 : -1)
      const scale = 1 + 0.15 * Math.sin(time * 3 + i)
      halo.scale.set(scale, scale, 1)
    })
  })

  return (
    <group>
      {CAMPUS_NODES.map((node, i) => (
        <group key={node.id} position={node.position}>
          {/* Core Sphere */}
          <mesh>
            <sphereGeometry args={[node.size, 20, 20]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={2.2}
              roughness={0.15}
              metalness={0.8}
            />
          </mesh>

          {/* Exterior Energy Shell */}
          <mesh>
            <sphereGeometry args={[node.size * 1.35, 16, 16]} />
            <meshBasicMaterial
              color={node.color}
              wireframe
              transparent
              opacity={0.3}
            />
          </mesh>

          {/* Orbital Halo Ring */}
          <mesh
            ref={(el) => {
              nodeHaloRefs.current[i] = el
            }}
            rotation={[Math.PI / 3, 0, 0]}
          >
            <ringGeometry
              args={[node.size * 1.6, node.size * 1.85, 32]}
            />
            <meshBasicMaterial
              color={node.color}
              side={THREE.DoubleSide}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Starfield particles in the background of Scene 06
function NetworkParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points | null>(null)
  const count = 320

  const { geometry, material } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const cCyan = new THREE.Color('#18CFFC')
    const cViolet = new THREE.Color('#7F1AFB')

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22
      positions[i * 3 + 1] = (Math.random() - 0.5) * 18
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16

      const col = Math.random() > 0.5 ? cCyan : cViolet
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geom, material: mat }
  }, [count])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state) => {
    if (reducedMotion || !pointsRef.current) return
    const t = state.clock.getElapsedTime()
    pointsRef.current.rotation.y = t * 0.02
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

// Camera Orbit & Scene Manager
function NetworkSceneContent({
  reducedMotion,
  pointerRef,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<{ x: number; y: number }>
}) {
  const sceneGroupRef = useRef<THREE.Group | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 0, 10.5)
  }, [camera])

  useFrame((state) => {
    if (!sceneGroupRef.current) return
    const t = state.clock.getElapsedTime()

    // Cinematic orbit rotation
    const orbitRotY = reducedMotion ? 0 : t * 0.08
    const orbitRotX = reducedMotion ? 0 : Math.sin(t * 0.05) * 0.04

    // Mouse parallax reaction
    const mouseX = pointerRef.current ? pointerRef.current.x * 0.3 : 0
    const mouseY = pointerRef.current ? pointerRef.current.y * 0.2 : 0

    // Smooth lerp
    sceneGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      sceneGroupRef.current.rotation.y,
      orbitRotY + mouseX,
      0.05
    )
    sceneGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      sceneGroupRef.current.rotation.x,
      orbitRotX - mouseY,
      0.05
    )
  })

  return (
    <group ref={sceneGroupRef}>
      {/* Cinematic Lighting */}
      <ambientLight color="#08080a" intensity={1.4} />
      <directionalLight position={[0, 10, 5]} intensity={1.8} color="#ffffff" />
      <pointLight
        position={[0, 0, 0]}
        color="#18CFFC"
        intensity={4.0}
        distance={25}
      />
      <pointLight
        position={[-6, 4, 3]}
        color="#7F1AFB"
        intensity={3.0}
        distance={18}
      />
      <pointLight
        position={[6, -4, 3]}
        color="#ED47FC"
        intensity={2.8}
        distance={18}
      />

      {/* Nodes */}
      <CampusNodes reducedMotion={reducedMotion} />

      {/* Spline Connections & Pulsing Packets */}
      <NetworkConnectionsAndPackets reducedMotion={reducedMotion} />

      {/* Background Particles */}
      <NetworkParticles reducedMotion={reducedMotion} />
    </group>
  )
}

export function NetworkCanvas3D({
  className = '',
  reducedMotion = false,
}: NetworkCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isInView, setIsInView] = useState(true)
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setWebGLSupported(isWebGLAvailable())
  }, [])

  // IntersectionObserver to pause rendering when scrolled out of view
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting)
      },
      { threshold: 0.05 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Pointer movement tracking for gentle parallax
  useEffect(() => {
    if (reducedMotion) return

    const handlePointerMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1
      pointerRef.current = { x, y }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [reducedMotion])

  const fallback = (
    <WebGLFallback
      type="network"
      reducedMotion={reducedMotion}
      className={className}
    />
  )

  if (webGLSupported === false) {
    return fallback
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-[#08080A] pointer-events-none select-none ${className}`}
      aria-hidden="true"
    >
      <WebGLErrorBoundary fallback={fallback}>
        {isInView ? (
          <Canvas
            frameloop="always"
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 10.5], fov: 48 }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              alpha: true,
            }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <NetworkSceneContent
              reducedMotion={reducedMotion}
              pointerRef={pointerRef}
            />
          </Canvas>
        ) : null}
      </WebGLErrorBoundary>

      {/* Cybernetic vignette overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 40%, rgba(8, 8, 10, 0.85) 100%)',
        }}
      />
    </div>
  )
}

export default NetworkCanvas3D
