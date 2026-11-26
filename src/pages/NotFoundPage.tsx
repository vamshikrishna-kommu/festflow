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
          <motion.div
            variants={reduced ? undefined : fadeUp}
            aria-hidden="true"
            className="font-display font-extrabold text-[7rem] sm:text-[9rem] leading-none text-gray-900 select-none mb-2 tracking-tighter"
          >
            404
          </motion.div>

          <motion.h1
            variants={reduced ? undefined : fadeUp}
            className="font-display font-bold text-2xl text-gray-900 mb-3"
          >
            Page not found
          </motion.h1>
          <motion.p
            variants={reduced ? undefined : fadeUp}
            className="text-sm text-gray-600 mb-8"
          >
            The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you back on track.
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
              variant="secondary"
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
