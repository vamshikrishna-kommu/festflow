import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import Lenis, { type LenisOptions } from 'lenis';

// Register GSAP plugins at module load
gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/**
 * Standard animation easing constants
 */
export const EASE = {
  fast: 'power2.out',
  smooth: 'power3.inOut',
  cinematic: 'expo.inOut',
  bounce: 'back.out(1.4)',
} as const;

/**
 * Global matchMedia instance for responsive & accessibility motion queries
 */
export const reducedMotionMediaQuery = gsap.matchMedia();
export const mm = reducedMotionMediaQuery;

// Internal tracker for ticker sync callbacks per Lenis instance
const tickerCallbacks = new Map<Lenis, (time: number) => void>();

/**
 * Initializes Lenis smooth scrolling synced to GSAP's ticker
 */
export function initLenis(options?: LenisOptions): Lenis {
  const lenis = new Lenis({
    smoothWheel: true,
    ...options,
  });

  // Sync ScrollTrigger updates with Lenis scroll events
  lenis.on('scroll', ScrollTrigger.update);

  // Drive Lenis requestAnimationFrame through GSAP ticker
  const tickerCallback = (time: number) => {
    lenis.raf(time * 1000);
  };

  tickerCallbacks.set(lenis, tickerCallback);
  gsap.ticker.add(tickerCallback);
  gsap.ticker.lagSmoothing(0);

  return lenis;
}

/**
 * Cleans up and destroys a Lenis instance and detaches it from the GSAP ticker
 */
export function destroyLenis(lenis?: Lenis | null): void {
  if (!lenis) return;
  const cb = tickerCallbacks.get(lenis);
  if (cb) {
    gsap.ticker.remove(cb);
    tickerCallbacks.delete(lenis);
  }
  lenis.destroy();
}

/**
 * Cleans up and kills an array of ScrollTrigger instances
 */
export function cleanupScrollTriggers(triggers: ScrollTrigger[]): void {
  if (!Array.isArray(triggers)) return;
  triggers.forEach((trigger) => {
    if (trigger && typeof trigger.kill === 'function') {
      trigger.kill();
    }
  });
}

export { gsap, ScrollTrigger, ScrollToPlugin, Lenis };
