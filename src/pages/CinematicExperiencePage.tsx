import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import { SEOHead } from '@/components/seo/SEOHead'
import { CinematicStoryCanvas } from '@/components/cinematic/story/CinematicStoryCanvas'
import { DeviceScreenContent } from '@/components/cinematic/story/DeviceScreenContent'
import { StoryControllerHUD } from '@/components/cinematic/story/StoryControllerHUD'

const SCENE_TITLES = [
  'Campus Ecosystem',
  'Discover Events',
  'Auditorium Seating',
  'Direct UPI Payment',
  'Digital Entry Pass',
  'Club Command Center',
  'The Final Reveal',
]

const SCENE_DURATIONS_MS = [9000, 9500, 10000, 9500, 9000, 10000, 12000]

export default function CinematicExperiencePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSceneParam = Number(searchParams.get('scene') || 0)
  const initialScene = !isNaN(initialSceneParam) && initialSceneParam >= 0 && initialSceneParam < SCENE_TITLES.length ? initialSceneParam : 0

  const [currentScene, setCurrentScene] = useState(initialScene)
  const [isPlaying, setIsPlaying] = useState(!searchParams.has('scene'))
  const progress = currentScene / (SCENE_TITLES.length - 1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartXRef = useRef<number | null>(null)

  // Sync state if searchParams change
  useEffect(() => {
    if (searchParams.has('scene')) {
      const s = Number(searchParams.get('scene'))
      if (!isNaN(s) && s >= 0 && s < SCENE_TITLES.length) {
        setCurrentScene(s)
        setIsPlaying(false)
      }
    }
  }, [searchParams])

  // Next / Previous Scene handlers
  const handleNext = useCallback(() => {
    setCurrentScene((prev) => {
      const next = prev < SCENE_TITLES.length - 1 ? prev + 1 : 0
      setSearchParams({ scene: String(next) }, { replace: true })
      return next
    })
  }, [setSearchParams])

  const handlePrev = useCallback(() => {
    setCurrentScene((prev) => {
      const next = prev > 0 ? prev - 1 : prev
      setSearchParams({ scene: String(next) }, { replace: true })
      return next
    })
  }, [setSearchParams])

  const handleSelectScene = useCallback((index: number) => {
    setCurrentScene(index)
    setSearchParams({ scene: String(index) }, { replace: true })
  }, [setSearchParams])

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const duration = SCENE_DURATIONS_MS[currentScene] || 9000
    timerRef.current = setTimeout(() => {
      handleNext()
    }, duration)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [currentScene, isPlaying, handleNext])

  // Keyboard navigation listener (←, →, Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleNext, handlePrev])

  // Touch Swipe gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchStartXRef.current - touchEndX

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext()
      } else {
        handlePrev()
      }
    }
    touchStartXRef.current = null
  }

  // Scene transition animations
  const sceneTransitionVariants = {
    initial: { opacity: 0, y: 16, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: 'easeOut' as const } },
    exit: { opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.3, ease: 'easeIn' as const } },
  }

  return (
    <div
      className="relative w-screen h-screen overflow-hidden bg-[#08080A] text-white select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SEOHead
        title="FestFlow — Cinematic Product Experience"
        description="Experience the complete collegiate event platform through an interconnected 3D campus journey, reserved seat selection, instant UPI verification, and verified passes."
        canonicalPath="/cinematic"
      />

      {/* ─── 3D THREE.JS PROCEDURAL UNIVERSE CANVAS ───────────────────────── */}
      <CinematicStoryCanvas
        currentScene={currentScene}
        progress={progress}
        isAutoPlaying={isPlaying}
        onSceneChange={handleSelectScene}
      />

      {/* ─── INTERACTIVE DEVICE FRAME & OVERLAY STAGE ──────────────────────── */}
      <main className="relative z-20 w-full h-full flex items-center justify-center p-4 sm:p-6 lg:p-8 pointer-events-none">
        {/* Responsive Device Container */}
        <div
          className={`w-full transition-all duration-700 pointer-events-auto ${
            currentScene === 0 || currentScene === 6
              ? 'max-w-2xl'
              : currentScene === 5
              ? 'max-w-3xl' // Tablet wide for club command center
              : 'max-w-[340px] sm:max-w-[370px]' // Smartphone mockup
          }`}
        >
          {/* Outer 3D Phone / Tablet Chassis Frame with glowing rim */}
          <div
            className={`w-full rounded-[2.5rem] p-2.5 sm:p-3 transition-all duration-700 ${
              currentScene === 0 || currentScene === 6
                ? 'bg-transparent'
                : 'bg-[#12141F] border border-[#18CFFC]/40 shadow-[0_24px_80px_rgba(0,0,0,0.9),0_0_50px_rgba(24,207,252,0.2)]'
            }`}
          >
            {/* Screen Viewport with aspect ratio */}
            <div
              className={`w-full rounded-[2rem] overflow-hidden transition-all duration-500 ${
                currentScene === 0 || currentScene === 6
                  ? 'h-[440px] sm:h-[480px]'
                  : currentScene === 5
                  ? 'h-[500px] sm:h-[540px]' // Wider tablet aspect
                  : 'h-[580px] sm:h-[620px]' // Smartphone vertical aspect
              }`}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentScene}
                  variants={sceneTransitionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full h-full"
                >
                  <DeviceScreenContent
                    currentScene={currentScene}
                    onNavigateScene={handleSelectScene}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* ─── PERSISTENT HUD NAVIGATION CONTROLLER ─────────────────────────── */}
      <StoryControllerHUD
        currentScene={currentScene}
        totalScenes={SCENE_TITLES.length}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        onSelectScene={handleSelectScene}
        onNext={handleNext}
        onPrev={handlePrev}
        sceneTitles={SCENE_TITLES}
      />
    </div>
  )
}
