/**
 * GSAP Core + Free Plugins Setup
 * Plugins registered once globally here — never re-register per component.
 * ScrollTrigger, Observer are free under the GSAP Standard License.
 */
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Observer } from 'gsap/Observer'

gsap.registerPlugin(ScrollTrigger, Observer)

// Default ease for cinematic feel
gsap.defaults({ ease: 'power2.out' })

export { gsap, ScrollTrigger, Observer }
export type Timeline = gsap.core.Timeline
export type Tween = gsap.core.Tween
