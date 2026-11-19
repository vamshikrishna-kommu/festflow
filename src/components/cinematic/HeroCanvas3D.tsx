import { useEffect, useRef, useState, useMemo, Component, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WebGLFallback } from './WebGLFallback'

export interface HeroCanvas3DProps {
  className?: string
  reducedMotion?: boolean
}

// Check for WebGL context support
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

// Error Boundary for WebGL initialization or context crashes
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
    console.warn('[HeroCanvas3D] WebGL render error caught by boundary:', error)
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

// Campus Monolith Data
interface MonolithData {
  id: number
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  color: string
  emissive: string
  geometryType: 'octa' | 'icosa' | 'box'
  speed: number
  floatOffset: number
}

// Event Node Data
interface EventNodeData {
  id: number
  position: [number, number, number]
  color: string
  size: number
  label: string
}

const MONOLITHS: MonolithData[] = [
  {
    id: 1,
    position: [-3.8, 0.5, -2],
    rotation: [0.3, 0.4, 0.2],
    scale: [1.2, 2.4, 1.2],
    color: '#0d1933',
    emissive: '#18CFFC',
    geometryType: 'octa',
    speed: 0.8,
    floatOffset: 0,
  },
  {
    id: 2,
    position: [3.6, -0.6, -2.5],
    rotation: [-0.2, 0.6, 0.3],
    scale: [1.4, 2.8, 1.4],
    color: '#1a0d33',
    emissive: '#7F1AFB',
    geometryType: 'icosa',
    speed: 0.6,
    floatOffset: 2.1,
  },
  {
    id: 3,
    position: [-2.2, -1.8, 0.5],
    rotation: [0.4, -0.3, 0.1],
    scale: [0.8, 1.6, 0.8],
    color: '#092540',
    emissive: '#07A4FC',
    geometryType: 'box',
    speed: 0.9,
    floatOffset: 4.2,
  },
  {
    id: 4,
    position: [2.5, 1.8, -1.2],
    rotation: [-0.3, 0.2, -0.4],
    scale: [1.0, 2.0, 1.0],
    color: '#28093d',
    emissive: '#ED47FC',
    geometryType: 'octa',
    speed: 0.7,
    floatOffset: 1.4,
  },
  {
    id: 5,
    position: [0.2, 2.4, -4],
    rotation: [0.5, 0.5, 0],
    scale: [1.6, 3.2, 1.6],
    color: '#0c162e',
    emissive: '#18CFFC',
    geometryType: 'icosa',
    speed: 0.5,
    floatOffset: 3.5,
  },
]

const EVENT_NODES: EventNodeData[] = [
  { id: 1, position: [-3.2, 1.2, 0.2], color: '#18CFFC', size: 0.28, label: 'Hackathon' },
  { id: 2, position: [-1.4, -0.5, 1.0], color: '#07A4FC', size: 0.24, label: 'Tech Summit' },
  { id: 3, position: [0.5, 0.8, 0.5], color: '#18CFFC', size: 0.32, label: 'Fest Main Stage' },
  { id: 4, position: [2.8, -0.8, 0.8], color: '#7F1AFB', size: 0.30, label: 'RoboWars' },
  { id: 5, position: [3.4, 1.4, -0.5], color: '#ED47FC', size: 0.26, label: 'Music Night' },
  { id: 6, position: [-0.6, 2.2, -1.2], color: '#7F1AFB', size: 0.22, label: 'Design Guild' },
  { id: 7, position: [1.8, -2.0, -0.8], color: '#0D56FB', size: 0.25, label: 'Startup Pitch' },
]

// Single Floating Monolith Mesh
function MonolithMesh({
  data,
  reducedMotion,
}: {
  data: MonolithData
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh | null>(null)
  const initialY = data.position[1]

  const geometry = useMemo(() => {
    switch (data.geometryType) {
      case 'octa':
        return new THREE.OctahedronGeometry(data.scale[0], 0)
      case 'icosa':
        return new THREE.IcosahedronGeometry(data.scale[0], 0)
      case 'box':
      default:
        return new THREE.BoxGeometry(
          data.scale[0],
          data.scale[1],
          data.scale[2]
        )
    }
  }, [data.geometryType, data.scale])

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: data.color,
      emissive: data.emissive,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.2,
      wireframe: false,
    })
  }, [data.color, data.emissive])

  const wireframeMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: data.emissive,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    })
  }, [data.emissive])

  // Dispose resources on unmount
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      wireframeMaterial.dispose()
    }
  }, [geometry, material, wireframeMaterial])

  useFrame((state) => {
    if (reducedMotion || !meshRef.current) return
    const t = state.clock.getElapsedTime() * data.speed + data.floatOffset
    meshRef.current.position.y = initialY + Math.sin(t) * 0.25
    meshRef.current.rotation.x = data.rotation[0] + Math.sin(t * 0.5) * 0.1
    meshRef.current.rotation.y = data.rotation[1] + Math.cos(t * 0.4) * 0.15
  })

  return (
    <group position={data.position}>
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={material}
        rotation={data.rotation}
      >
        {/* Wireframe shell overlay for futuristic crystalline glow */}
        <mesh geometry={geometry} material={wireframeMaterial} scale={1.03} />
      </mesh>
    </group>
  )
}

// Interconnected Event Nodes and Glowing Energy Pathways
function InterconnectedNetwork({ reducedMotion }: { reducedMotion: boolean }) {
  const lineGroupRef = useRef<THREE.Group | null>(null)

  // Energy pathways: lines connecting event nodes
  const { lineGeometry, lineMaterial } = useMemo(() => {
    const points: THREE.Vector3[] = []
    const connections: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [1, 6],
      [3, 6],
      [5, 0],
      [4, 2],
    ]

    connections.forEach(([startIdx, endIdx]) => {
      const start = EVENT_NODES[startIdx].position
      const end = EVENT_NODES[endIdx].position
      points.push(new THREE.Vector3(...start))
      points.push(new THREE.Vector3(...end))
    })

    const geom = new THREE.BufferGeometry().setFromPoints(points)
    const mat = new THREE.LineBasicMaterial({
      color: '#18CFFC',
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    })

    return { lineGeometry: geom, lineMaterial: mat }
  }, [])

  // Dispose lines on unmount
  useEffect(() => {
    return () => {
      lineGeometry.dispose()
      lineMaterial.dispose()
    }
  }, [lineGeometry, lineMaterial])

  useFrame((state) => {
    if (reducedMotion || !lineMaterial) return
    const t = state.clock.getElapsedTime()
    // Subtle breathing pulse on pathways
    lineMaterial.opacity = 0.3 + 0.15 * Math.sin(t * 2)
  })

  return (
    <group ref={lineGroupRef}>
      {/* Network Lines */}
      <lineSegments geometry={lineGeometry} material={lineMaterial} />

      {/* Glowing Event Nodes */}
      {EVENT_NODES.map((node) => (
        <group key={node.id} position={node.position}>
          {/* Inner Core */}
          <mesh>
            <sphereGeometry args={[node.size, 16, 16]} />
            <meshStandardMaterial
              color={node.color}
              emissive={node.color}
              emissiveIntensity={1.8}
              roughness={0.1}
            />
          </mesh>
          {/* Glowing Halo Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[node.size * 1.4, node.size * 1.6, 24]} />
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

// Controlled Particle Field
function ParticleField({ reducedMotion }: { reducedMotion: boolean }) {
  const pointsRef = useRef<THREE.Points | null>(null)
  const particleCount = 280

  const { geometry, material } = useMemo(() => {
    const geom = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    const colorCyan = new THREE.Color('#18CFFC')
    const colorViolet = new THREE.Color('#7F1AFB')
    const colorSky = new THREE.Color('#07A4FC')

    for (let i = 0; i < particleCount; i++) {
      // Distributed in 3D volume
      positions[i * 3] = (Math.random() - 0.5) * 18
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12

      // Pick accent color
      const r = Math.random()
      const c = r < 0.45 ? colorCyan : r < 0.8 ? colorViolet : colorSky
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    })

    return { geometry: geom, material: mat }
  }, [particleCount])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state) => {
    if (reducedMotion || !pointsRef.current) return
    const t = state.clock.getElapsedTime()
    pointsRef.current.rotation.y = t * 0.03
    pointsRef.current.rotation.x = Math.sin(t * 0.02) * 0.05
  })

  return <points ref={pointsRef} geometry={geometry} material={material} />
}

// Scene Root with gentle rotation and subtle pointer parallax reaction
function SceneContent({
  reducedMotion,
  pointerRef,
}: {
  reducedMotion: boolean
  pointerRef: React.RefObject<{ x: number; y: number }>
}) {
  const rootGroupRef = useRef<THREE.Group | null>(null)
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 0, 8.5)
  }, [camera])

  useFrame((state) => {
    if (!rootGroupRef.current) return
    const t = state.clock.getElapsedTime()

    // Base rotation
    const baseRotY = reducedMotion ? 0 : t * 0.05
    const baseRotX = reducedMotion ? 0 : Math.sin(t * 0.04) * 0.03

    // Mouse parallax reaction
    const mouseX = pointerRef.current ? pointerRef.current.x * 0.35 : 0
    const mouseY = pointerRef.current ? pointerRef.current.y * 0.25 : 0

    // Smooth lerp
    rootGroupRef.current.rotation.y = THREE.MathUtils.lerp(
      rootGroupRef.current.rotation.y,
      baseRotY + mouseX,
      0.06
    )
    rootGroupRef.current.rotation.x = THREE.MathUtils.lerp(
      rootGroupRef.current.rotation.x,
      baseRotX - mouseY,
      0.06
    )
  })

  return (
    <group ref={rootGroupRef}>
      {/* Dynamic Lighting */}
      <ambientLight color="#080c1a" intensity={1.2} />
      <directionalLight position={[5, 8, 5]} intensity={1.5} color="#ffffff" />
      <pointLight
        position={[-6, 3, 2]}
        color="#18CFFC"
        intensity={3.5}
        distance={20}
      />
      <pointLight
        position={[6, -3, 2]}
        color="#7F1AFB"
        intensity={3.5}
        distance={20}
      />
      <pointLight
        position={[0, 5, -2]}
        color="#07A4FC"
        intensity={2.0}
        distance={15}
      />

      {/* Floating Monoliths */}
      {MONOLITHS.map((m) => (
        <MonolithMesh key={m.id} data={m} reducedMotion={reducedMotion} />
      ))}

      {/* Interconnected Event Nodes */}
      <InterconnectedNetwork reducedMotion={reducedMotion} />

      {/* Particle Field */}
      <ParticleField reducedMotion={reducedMotion} />
    </group>
  )
}

export function HeroCanvas3D({
  className = '',
  reducedMotion = false,
}: HeroCanvas3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isInView, setIsInView] = useState(true)
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null)

  // Verify WebGL availability on mount
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

  // Subtle mouse movement listener for parallax
  useEffect(() => {
    if (reducedMotion) return

    const handlePointerMove = (e: PointerEvent) => {
      // Normalize pointer from -1 to 1
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -(e.clientY / window.innerHeight) * 2 + 1
      pointerRef.current = { x, y }
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [reducedMotion])

  // Fallback if WebGL is unavailable or when reduced motion is requested
  const fallback = (
    <WebGLFallback
      type="hero"
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
            camera={{ position: [0, 0, 8.5], fov: 45 }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              alpha: true,
            }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <SceneContent
              reducedMotion={reducedMotion}
              pointerRef={pointerRef}
            />
          </Canvas>
        ) : null}
      </WebGLErrorBoundary>

      {/* Cybernetic vignette gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 45%, rgba(8, 8, 10, 0.85) 100%)',
        }}
      />
    </div>
  )
}

export default HeroCanvas3D
