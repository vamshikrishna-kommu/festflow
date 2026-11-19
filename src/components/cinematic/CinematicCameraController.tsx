import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playChime, isAudioActive } from '@/lib/audio'

export interface CinematicCameraControllerProps {
  scrollProgress: number // 0.0 to 1.0
  reducedMotion?: boolean
}

interface Waypoint {
  t: number
  position: [number, number, number]
  lookAt: [number, number, number]
}

// Choreographed 10-World Camera Path
const WAYPOINTS: Waypoint[] = [
  // World 1: The Void / FestFlow Awakens (Deep cosmic approach)
  { t: 0.0, position: [0, 1.5, 12], lookAt: [0, 0, 0] },
  { t: 0.08, position: [0, 0.4, 7.2], lookAt: [0, 0, 0] },

  // World 2: The Campus Reveals Itself (Flying into architectural campus)
  { t: 0.14, position: [3.2, 4.0, 6.0], lookAt: [0, 0.8, -0.5] },
  { t: 0.22, position: [0, 1.5, 3.2], lookAt: [0, 0.6, -1.0] },

  // World 3: Human Energy / Campus Pulse (Atrium & collaboration orbit)
  { t: 0.30, position: [-2.4, 2.2, 4.8], lookAt: [0.3, 0.6, 0] },
  { t: 0.36, position: [1.6, 1.4, 3.8], lookAt: [-0.2, 0.5, 0] },

  // World 4: The Event Multiverse (Cinematic orbit around multiverse realms)
  { t: 0.44, position: [-4.0, 2.0, 5.0], lookAt: [0, 0.5, 0] },
  { t: 0.52, position: [4.0, 1.8, 4.0], lookAt: [0, 0.5, 0] },

  // World 5: Discover / Enter the Portal (Portal perspective approach)
  { t: 0.60, position: [0, 1.2, 5.0], lookAt: [0, 0.3, 0] },

  // World 6: The Student Journey (Device stage view)
  { t: 0.70, position: [0, 0.8, 4.5], lookAt: [0, 0.4, 0] },

  // World 7: The Organizer Command Center (Spatial angled perspective)
  { t: 0.78, position: [2.0, 1.6, 4.8], lookAt: [0, 0.6, 0] },

  // World 8: The Connected Campus Network (Network aerial overview looking down)
  { t: 0.88, position: [0, 8.0, 12.0], lookAt: [0, 0, 0] },

  // World 9: The Infinite Event Space (Atmospheric warp forward)
  { t: 0.94, position: [0, 2.4, 8.5], lookAt: [0, 0.6, 0] },

  // World 10: The Grand Convergence (Direct frontal focus)
  { t: 1.0, position: [0, 1.0, 8.0], lookAt: [0, 0.5, 0] },
]

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return x * x * (3 - 2 * x)
}

function interpolateWaypoints(
  progress: number,
  outPos: THREE.Vector3,
  outLookAt: THREE.Vector3
) {
  const clamped = Math.max(0, Math.min(1, progress))

  // Find surrounding waypoint segment
  let p0 = WAYPOINTS[0]
  let p1 = WAYPOINTS[WAYPOINTS.length - 1]

  for (let i = 0; i < WAYPOINTS.length - 1; i++) {
    if (clamped >= WAYPOINTS[i].t && clamped <= WAYPOINTS[i + 1].t) {
      p0 = WAYPOINTS[i]
      p1 = WAYPOINTS[i + 1]
      break
    }
  }

  const factor = p1.t === p0.t ? 0 : smoothstep(p0.t, p1.t, clamped)

  outPos.set(
    THREE.MathUtils.lerp(p0.position[0], p1.position[0], factor),
    THREE.MathUtils.lerp(p0.position[1], p1.position[1], factor),
    THREE.MathUtils.lerp(p0.position[2], p1.position[2], factor)
  )

  outLookAt.set(
    THREE.MathUtils.lerp(p0.lookAt[0], p1.lookAt[0], factor),
    THREE.MathUtils.lerp(p0.lookAt[1], p1.lookAt[1], factor),
    THREE.MathUtils.lerp(p0.lookAt[2], p1.lookAt[2], factor)
  )
}

export function CinematicCameraController({
  scrollProgress,
  reducedMotion = false,
}: CinematicCameraControllerProps) {
  const { camera } = useThree()

  // Cached math vectors to avoid heap allocations in render loop
  const targetPosRef = useRef(new THREE.Vector3())
  const targetLookAtRef = useRef(new THREE.Vector3())
  const currentLookAtRef = useRef(new THREE.Vector3(0, 0, 0))
  const lastWorldIndexRef = useRef<number>(-1)

  // Track world transitions for sound chimes
  useEffect(() => {
    const currentWorld = Math.min(9, Math.floor(scrollProgress * 10))
    if (lastWorldIndexRef.current !== -1 && lastWorldIndexRef.current !== currentWorld) {
      if (isAudioActive()) {
        const toneMultipliers = [1.0, 1.12, 1.25, 1.33, 1.5, 1.66, 1.75, 2.0, 2.25, 2.5]
        playChime(toneMultipliers[currentWorld] || 1.0)
      }
    }
    lastWorldIndexRef.current = currentWorld
  }, [scrollProgress])

  useFrame((state, delta) => {
    // 1. Calculate target path point from scroll progress
    interpolateWaypoints(scrollProgress, targetPosRef.current, targetLookAtRef.current)

    // 2. Add subtle pointer parallax if reduced-motion is not preferred
    if (!reducedMotion) {
      const px = state.pointer.x * 0.4
      const py = state.pointer.y * 0.25
      targetPosRef.current.x += px
      targetPosRef.current.y += py
    }

    // 3. Smooth dampening (exponential frame-rate independent lerp)
    const dampSpeed = reducedMotion ? 8.0 : 4.5
    const alpha = 1 - Math.exp(-dampSpeed * Math.min(delta, 0.1))

    camera.position.lerp(targetPosRef.current, alpha)
    currentLookAtRef.current.lerp(targetLookAtRef.current, alpha)
    camera.lookAt(currentLookAtRef.current)
  })

  return null
}
