import { Link } from 'react-router'
import { motion } from 'motion/react'
import { Home, ArrowLeft } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui'
import { fadeUp, staggerContainer } from '@/lib/animations'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export default function NotFoundPage() {
  const reduced = useReducedMotion()

  return (
    <PageShell>
      <div className="flex-1 flex items-center justify-center min-h-[60dvh] px-6">
        <motion.div
          variants={staggerContainer}
          initial={reduced ? 'visible' : 'hidden'}
          animate="visible"
          className="text-center max-w-md"
        >
          {/* 404 Glyph */}
          <motion.div
            variants={reduced ? undefined : fadeUp}
            aria-hidden="true"
            className="font-display font-extrabold text-[8rem] sm:text-[10rem] leading-none bg-gradient-to-r from-[#18CFFC] via-[#07A4FC] to-[#7F1AFB] bg-clip-text text-transparent select-none mb-2 tracking-tighter drop-shadow-[0_10px_30px_rgba(24,207,252,0.35)]"
          >
            404
          </motion.div>

          <motion.h1
            variants={reduced ? undefined : fadeUp}
            className="font-display font-bold text-2xl text-[var(--color-text-primary)] mb-3"
          >
            Page not found
          </motion.h1>
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="text-[var(--color-text-secondary)] mb-8"
          >
            The page you're looking for doesn't exist or has been moved. Let's get you
            back on track.
          </motion.p>

          <motion.div
            variants={reduced ? undefined : fadeUp}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link to="/">
              <Button
                id="404-home"
                variant="primary"
                leftIcon={<Home size={16} />}
              >
                Back to home
              </Button>
            </Link>
            <Button
              id="404-back"
              variant="outline"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => window.history.back()}
            >
              Go back
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </PageShell>
  )
}
