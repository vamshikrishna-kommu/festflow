import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Menu,
  X,
  Sparkles,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Building2,
  GraduationCap,
  ChevronDown,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { navbarSlide, fadeIn } from '@/lib/animations'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured, isProduction } from '@/lib/supabase'

const NAV_LINKS = [
  { label: 'Discover', href: '/discover' },
  { label: 'For Clubs', href: '/#for-clubs' },
  { label: 'Pricing', href: '/#pricing' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [loginMenuOpen, setLoginMenuOpen] = useState(false)
  const loginMenuRef = useRef<HTMLDivElement>(null)
  const progress = useScrollProgress()
  const navigate = useNavigate()

  const { session, profile, role, signOut, isLoading } = useAuth()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close menus on ESC or click outside
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setLoginMenuOpen(false)
      }
    }
    const onClickOutside = (e: MouseEvent) => {
      if (loginMenuRef.current && !loginMenuRef.current.contains(e.target as Node)) {
        setLoginMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [])

  const isClub = role === 'club_member'
  const dashboardPath = isClub ? '/club/dashboard' : '/student/dashboard'

  return (
    <>
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 z-[60] h-[2px] bg-gradient-to-r from-[var(--color-brand-purple)] via-[var(--color-brand-pink)] to-[var(--color-brand-amber)] origin-left pointer-events-none"
        style={{ scaleX: progress, transformOrigin: '0%' }}
      />

      <motion.header
        variants={navbarSlide}
        initial="hidden"
        animate="visible"
        className={`fixed top-2 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl transition-all duration-300 rounded-[var(--radius-card)] ${
          scrolled
            ? 'glass shadow-[0_8px_32px_oklch(0%_0_0_/_0.5)]'
            : 'bg-transparent'
        }`}
      >
        {isProduction && !isSupabaseConfigured && (
          <div className="bg-red-600/90 text-white text-[11px] py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2 rounded-t-[var(--radius-card)] shadow-sm">
            <AlertTriangle size={14} className="shrink-0 text-amber-200" />
            <span>Production Notice: Supabase credentials are not set. Configure VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY in your hosting dashboard.</span>
          </div>
        )}
        <nav
          aria-label="Main navigation"
          className="flex items-center justify-between px-5 py-3"
        >
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 group"
            aria-label="FestFlow home"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)]">
              <Sparkles size={16} className="text-white" />
            </span>
            <span className="font-display font-bold text-xl text-[var(--color-text-primary)] group-hover:gradient-text transition-all">
              FestFlow
            </span>
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-1" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <NavLink
                  to={link.href}
                  className={({ isActive }) =>
                    `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive && link.href === '/discover'
                        ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-3)]'
                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Desktop CTA / Auth actions */}
          <div className="hidden md:flex items-center gap-3">
            {!isLoading && session ? (
              // Authenticated user state
              <div className="flex items-center gap-2">
                <NotificationBell />
                <Link to={dashboardPath}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-brand-purple)] to-[var(--color-brand-pink)] text-white text-[11px] font-bold flex items-center justify-center">
                      {profile?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] max-w-[120px] truncate">
                      {profile?.display_name || 'My Account'}
                    </span>
                    <Badge variant={isClub ? 'purple' : 'cyan'} className="text-[10px] py-0 px-1.5">
                      {isClub ? 'Club' : 'Student'}
                    </Badge>
                  </Button>
                </Link>

                <Link to={dashboardPath}>
                  <Button
                    variant={isClub ? 'ghost' : 'primary'}
                    size="sm"
                    leftIcon={<LayoutDashboard size={14} />}
                  >
                    Dashboard
                  </Button>
                </Link>

                {isClub && (
                  <Link to="/club/events/new">
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Plus size={14} />}
                    >
                      New Event
                    </Button>
                  </Link>
                )}

                <button
                  type="button"
                  title="Sign out"
                  aria-label="Sign out"
                  onClick={async () => {
                    await signOut()
                    navigate('/')
                  }}
                  className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              // Unauthenticated state
              <div className="flex items-center gap-2 relative" ref={loginMenuRef}>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLoginMenuOpen((prev) => !prev)}
                    rightIcon={<ChevronDown size={14} className={`transition-transform duration-200 ${loginMenuOpen ? 'rotate-180' : ''}`} />}
                  >
                    Log in
                  </Button>

                  <AnimatePresence>
                    {loginMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-full mt-2 w-48 p-1.5 rounded-xl glass shadow-xl border border-[oklch(100%_0_0_/_0.1)] flex flex-col gap-1 z-50 text-xs"
                      >
                        <Link
                          to="/student/login"
                          onClick={() => setLoginMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                        >
                          <GraduationCap size={15} className="text-[var(--color-brand-cyan)]" />
                          <div>
                            <span className="font-semibold block">Student Login</span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">Find tickets & passes</span>
                          </div>
                        </Link>
                        <Link
                          to="/club/login"
                          onClick={() => setLoginMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                        >
                          <Building2 size={15} className="text-[var(--color-brand-purple)]" />
                          <div>
                            <span className="font-semibold block">Club Organizer</span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">Manage events & entry</span>
                          </div>
                        </Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <Link to="/club/signup">
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ChevronRight size={14} />}
                  >
                    Start a Club
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger & notifications */}
          <div className="flex items-center gap-1 md:hidden">
            {session && <NotificationBell />}
            <button
              id="mobile-menu-toggle"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 z-40 pt-24 px-4 pb-8 glass md:hidden flex flex-col"
          >
            <ul className="flex flex-col gap-1" role="list">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <NavLink
                    to={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-base font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                  >
                    {link.label}
                    <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-[oklch(100%_0_0_/_0.08)]">
              {session ? (
                <>
                  <div className="flex items-center justify-between px-2 py-1 text-sm text-[var(--color-text-secondary)]">
                    <span>Signed in as <strong className="text-[var(--color-text-primary)]">{profile?.display_name}</strong></span>
                    <Badge variant={isClub ? 'purple' : 'cyan'}>{role}</Badge>
                  </div>
                  <Link to={dashboardPath} onClick={() => setMobileOpen(false)}>
                    <Button variant={isClub ? 'outline' : 'primary'} size="lg" className="w-full" leftIcon={<LayoutDashboard size={16} />}>
                      Go to Dashboard
                    </Button>
                  </Link>
                  {isClub && (
                    <Link to="/club/events/new" onClick={() => setMobileOpen(false)}>
                      <Button variant="primary" size="lg" className="w-full" leftIcon={<Plus size={16} />}>
                        Create New Event
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full text-rose-400"
                    onClick={async () => {
                      setMobileOpen(false)
                      await signOut()
                      navigate('/')
                    }}
                    leftIcon={<LogOut size={16} />}
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Link to="/student/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="md" className="w-full">
                        Student Login
                      </Button>
                    </Link>
                    <Link to="/club/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="md" className="w-full">
                        Club Login
                      </Button>
                    </Link>
                  </div>
                  <Link to="/club/signup" onClick={() => setMobileOpen(false)}>
                    <Button variant="primary" size="lg" className="w-full">
                      Register Club Free
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
