import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { motion, AnimatePresence } from 'motion/react'
import {
  Menu,
  X,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  Building2,
  GraduationCap,
  ChevronDown,
  Plus,
  AlertTriangle,
  Calendar,
  CreditCard,
  Ticket,
} from 'lucide-react'
import { Button, Badge, Logo } from '@/components/ui'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { navbarSlide, dropdownMenu } from '@/lib/animations'
import { useScrollProgress } from '@/hooks/useScrollProgress'
import { useAuth } from '@/context/AuthContext'
import { isSupabaseConfigured, isProduction } from '@/lib/supabase'

interface NavItem {
  label: string
  href: string
}

const PUBLIC_NAV_LINKS: NavItem[] = [
  { label: 'Discover', href: '/discover' },
  { label: 'Features', href: '/#features' },
  { label: 'For Clubs', href: '/club/signup' },
  { label: 'Contact', href: '/contact' },
]

const STUDENT_NAV_LINKS: NavItem[] = [
  { label: 'Discover', href: '/discover' },
  { label: 'My Dashboard', href: '/student/dashboard' },
]

const CLUB_NAV_LINKS: NavItem[] = [
  { label: 'Discover Events', href: '/discover' },
  { label: 'Club Dashboard', href: '/club/dashboard' },
  { label: 'Manage Events', href: '/club/events' },
  { label: 'Payments', href: '/club/payments' },
]

const UNRESOLVED_NAV_LINKS: NavItem[] = [
  { label: 'Discover', href: '/discover' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [scrolled, setScrolled]       = useState(false)
  const [loginMenuOpen, setLoginMenu] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const loginMenuRef                   = useRef<HTMLDivElement>(null)
  const userMenuRef                    = useRef<HTMLDivElement>(null)
  const progress                       = useScrollProgress()
  const navigate                       = useNavigate()
  const { session, profile, role, signOut, isLoading } = useAuth()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        setLoginMenu(false)
        setUserMenuOpen(false)
      }
    }
    const onOut = (e: MouseEvent) => {
      if (loginMenuRef.current && !loginMenuRef.current.contains(e.target as Node)) {
        setLoginMenu(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onOut)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onOut)
    }
  }, [])

  // Lock body scroll when mobile menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const isClub = role === 'club_member' || role === 'platform_admin'
  const isStudent = role === 'student'

  // Determine current active navigation links based on auth role
  const activeNavLinks = useMemo(() => {
    if (isLoading) return []
    if (!session) return PUBLIC_NAV_LINKS
    if (isClub) return CLUB_NAV_LINKS
    if (isStudent) return STUDENT_NAV_LINKS
    return UNRESOLVED_NAV_LINKS
  }, [isLoading, session, isClub, isStudent])

  const userInitial = (
    profile?.display_name?.charAt(0) ||
    session?.user?.email?.charAt(0) ||
    'U'
  ).toUpperCase()

  const userDisplayName = profile?.display_name || (isClub ? 'Club Organizer' : 'Student')

  return (
    <>
      {/* Scroll progress bar */}
      <motion.div
        className="fixed top-0 left-0 z-[60] h-[2px] origin-left pointer-events-none"
        style={{
          scaleX: progress,
          transformOrigin: '0%',
          background: 'linear-gradient(90deg, var(--color-brand-violet), var(--color-brand-fuchsia))',
        }}
      />

      <motion.header
        variants={navbarSlide}
        initial="hidden"
        animate="visible"
        className={`sticky top-0 z-50 w-full transition-all duration-300 border-b ${
          scrolled
            ? 'glass border-[oklch(100%_0_0_/_0.08)] shadow-[0_4px_30px_oklch(0%_0_0_/_0.4)]'
            : 'bg-[var(--color-surface-0)]/90 backdrop-blur-md border-[oklch(100%_0_0_/_0.06)]'
        }`}
      >
        {isProduction && !isSupabaseConfigured && (
          <div className="bg-rose-600/90 text-white text-[10px] sm:text-[11px] py-1.5 px-4 text-center font-medium flex items-center justify-center gap-2">
            <AlertTriangle size={12} className="shrink-0 text-amber-200" />
            <span className="truncate">Supabase credentials missing — configure in hosting dashboard.</span>
          </div>
        )}

        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav
            aria-label="Main navigation"
            className="flex items-center justify-between h-16 sm:h-18"
          >
            {/* Logo */}
            <Link to="/" className="flex items-center shrink-0" aria-label="FestFlow home">
              <Logo variant="navbar" />
            </Link>

            {/* Desktop links */}
            <ul className="hidden md:flex items-center gap-1" role="list">
              {isLoading ? (
                // Smooth skeleton placeholder while session/role is resolving
                <li className="flex items-center gap-2 px-3 py-1">
                  <div className="h-6 w-20 rounded-lg bg-[var(--color-surface-2)]/70 animate-pulse" />
                  <div className="h-6 w-20 rounded-lg bg-[var(--color-surface-2)]/70 animate-pulse" />
                </li>
              ) : (
                activeNavLinks.map((link) => (
                  <li key={link.href}>
                    <NavLink
                      to={link.href}
                      className={({ isActive }) =>
                        `relative px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive && (link.href === '/discover' || link.href === '/student/dashboard' || link.href === '/club/dashboard')
                            ? 'text-[var(--color-text-primary)] bg-[var(--color-surface-3)] font-semibold'
                            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]'
                        }`
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))
              )}
            </ul>

            {/* Desktop auth area */}
            <div className="hidden md:flex items-center gap-2.5">
              {isLoading ? (
                <div className="h-8 w-24 rounded-xl bg-[var(--color-surface-2)]/70 animate-pulse" />
              ) : session ? (
                <div className="flex items-center gap-2">
                  <NotificationBell />

                  {isClub && (
                    <Link to="/club/events/new">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Plus size={14} />}
                        className="shine-on-hover shadow-sm"
                      >
                        New Event
                      </Button>
                    </Link>
                  )}

                  {/* Authenticated User Menu Dropdown */}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((p) => !p)}
                      aria-label="User account menu"
                      aria-expanded={userMenuOpen}
                      className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] border border-transparent hover:border-[oklch(100%_0_0_/_0.08)] transition-all cursor-pointer"
                    >
                      <span className="w-7 h-7 rounded-full gradient-brand text-white text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                        {userInitial}
                      </span>
                      <span className="max-w-[120px] truncate text-xs font-semibold">
                        {userDisplayName}
                      </span>
                      <ChevronDown
                        size={13}
                        className={`text-[var(--color-text-muted)] transition-transform duration-200 ${
                          userMenuOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          variants={dropdownMenu}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="absolute right-0 top-full mt-2 w-60 p-2 rounded-2xl glass-elevated shadow-2xl border border-[oklch(100%_0_0_/_0.12)] flex flex-col gap-1 z-50 text-left"
                        >
                          {/* User Identity Header */}
                          <div className="px-3 py-2 border-b border-[oklch(100%_0_0_/_0.08)] mb-1">
                            <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                              {userDisplayName}
                            </p>
                            <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                              {session.user.email}
                            </p>
                            <div className="mt-1.5">
                              <Badge variant={isClub ? 'purple' : 'cyan'} className="text-[10px] py-0 px-2 font-medium">
                                {isClub ? (role === 'platform_admin' ? 'Admin' : 'Club Organizer') : 'Student'}
                              </Badge>
                            </div>
                          </div>

                          {/* Role-Specific Navigation Links */}
                          {isClub ? (
                            <>
                              <Link
                                to="/club/dashboard"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
                              >
                                <LayoutDashboard size={14} className="text-[var(--color-brand-violet)]" />
                                <span>Club Dashboard</span>
                              </Link>
                              <Link
                                to="/club/events"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
                              >
                                <Calendar size={14} className="text-[var(--color-brand-purple)]" />
                                <span>Manage Events</span>
                              </Link>
                              <Link
                                to="/club/payments"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
                              >
                                <CreditCard size={14} className="text-[var(--color-brand-cyan)]" />
                                <span>Payments & UPI</span>
                              </Link>
                            </>
                          ) : isStudent ? (
                            <>
                              <Link
                                to="/student/dashboard"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                              >
                                <LayoutDashboard size={14} className="text-[var(--color-brand-violet)]" />
                                <span>Dashboard Overview</span>
                              </Link>
                              <Link
                                to="/student/dashboard"
                                onClick={() => setUserMenuOpen(false)}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
                              >
                                <Ticket size={14} className="text-[var(--color-brand-cyan)]" />
                                <span>My Passes & Tickets</span>
                              </Link>
                            </>
                          ) : (
                            <Link
                              to="/discover"
                              onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-surface-3)] transition-colors"
                            >
                              <span>Explore Events</span>
                            </Link>
                          )}

                          <div className="my-1 border-t border-[oklch(100%_0_0_/_0.08)]" />

                          <button
                            type="button"
                            onClick={async () => {
                              setUserMenuOpen(false)
                              await signOut()
                              navigate('/')
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                          >
                            <LogOut size={14} />
                            <span>Sign Out</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 relative" ref={loginMenuRef}>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLoginMenu((p) => !p)}
                      rightIcon={
                        <ChevronDown
                          size={13}
                          className={`transition-transform duration-200 ${loginMenuOpen ? 'rotate-180' : ''}`}
                        />
                      }
                    >
                      Log in
                    </Button>

                    <AnimatePresence>
                      {loginMenuOpen && (
                        <motion.div
                          variants={dropdownMenu}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          className="absolute right-0 top-full mt-2 w-52 p-1.5 rounded-2xl glass-elevated shadow-xl border border-[oklch(100%_0_0_/_0.1)] flex flex-col gap-0.5 z-50"
                        >
                          <Link
                            to="/student/login"
                            onClick={() => setLoginMenu(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'oklch(72% 0.16 200 / 0.15)' }}>
                              <GraduationCap size={14} className="text-[var(--color-brand-cyan)]" />
                            </div>
                            <div>
                              <span className="font-semibold text-sm block">Student</span>
                              <span className="text-[11px] text-[var(--color-text-muted)]">Find & attend events</span>
                            </div>
                          </Link>
                          <Link
                            to="/club/login"
                            onClick={() => setLoginMenu(false)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: 'oklch(58% 0.26 285 / 0.18)' }}>
                              <Building2 size={14} className="text-[var(--color-brand-violet)]" />
                            </div>
                            <div>
                              <span className="font-semibold text-sm block">Club Organizer</span>
                              <span className="text-[11px] text-[var(--color-text-muted)]">Manage events & entry</span>
                            </div>
                          </Link>
                          <div className="my-1 border-t border-[oklch(100%_0_0_/_0.07)]" />
                          <Link
                            to="/student/signup"
                            onClick={() => setLoginMenu(false)}
                            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-brand-cyan)] hover:bg-[var(--color-surface-3)] transition-colors"
                          >
                            <span>New student? Sign up free</span>
                            <ChevronRight size={12} />
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
                      className="shine-on-hover"
                    >
                      Start a Club
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile: notifications + hamburger */}
            <div className="flex items-center gap-1 md:hidden">
              {session && <NotificationBell />}
              <button
                id="mobile-menu-toggle"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls="mobile-menu"
                className="p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </nav>
        </div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] md:hidden flex flex-col"
            style={{ background: 'oklch(6% 0.018 265 / 0.98)' }}
          >
            {/* Backdrop blur */}
            <div className="absolute inset-0 backdrop-blur-xl" />

            {/* Mobile drawer dedicated top bar */}
            <div className="relative z-10 flex items-center justify-between px-4 py-3.5 border-b border-[oklch(100%_0_0_/_0.08)] shrink-0">
              <Link to="/" onClick={() => setMobileOpen(false)} aria-label="FestFlow home">
                <Logo variant="navbar" />
              </Link>
              <button
                type="button"
                aria-label="Close menu"
                className="p-2 rounded-xl text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 flex flex-col flex-1 px-5 py-6 pb-safe overflow-y-auto"
            >
              {/* Authenticated User Header in Mobile Drawer */}
              {session && (
                <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-2xl bg-[var(--color-surface-2)] border border-[oklch(100%_0_0_/_0.08)]">
                  <span className="w-10 h-10 rounded-full gradient-brand text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-sm">
                    {userInitial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{userDisplayName}</p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{session.user.email}</p>
                    <div className="mt-1">
                      <Badge variant={isClub ? 'purple' : 'cyan'} className="text-[10px] py-0 px-2 font-medium">
                        {isClub ? (role === 'platform_admin' ? 'Admin' : 'Club Organizer') : 'Student'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Role-Aware Nav links */}
              <ul className="flex flex-col gap-1 mb-8" role="list">
                {activeNavLinks.map((link, i) => (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <NavLink
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between px-4 py-3.5 min-h-[52px] rounded-2xl text-lg font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-3)] transition-colors"
                    >
                      {link.label}
                      <ChevronRight size={18} className="text-[var(--color-text-muted)]" />
                    </NavLink>
                  </motion.li>
                ))}
              </ul>

              {/* Auth area actions */}
              <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-[oklch(100%_0_0_/_0.08)]">
                {session ? (
                  <>
                    {isClub ? (
                      <>
                        <Link to="/club/dashboard" onClick={() => setMobileOpen(false)}>
                          <Button variant="primary" size="lg" className="w-full" leftIcon={<LayoutDashboard size={16} />}>
                            Club Dashboard
                          </Button>
                        </Link>
                        <Link to="/club/events/new" onClick={() => setMobileOpen(false)}>
                          <Button variant="outline" size="lg" className="w-full" leftIcon={<Plus size={16} />}>
                            Create New Event
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <Link to="/student/dashboard" onClick={() => setMobileOpen(false)}>
                        <Button variant="primary" size="lg" className="w-full" leftIcon={<LayoutDashboard size={16} />}>
                          Go to My Dashboard
                        </Button>
                      </Link>
                    )}

                    <Button
                      variant="ghost"
                      size="lg"
                      className="w-full text-rose-400 hover:bg-rose-500/10 cursor-pointer"
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
                    <Link to="/student/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" size="lg" className="w-full" leftIcon={<GraduationCap size={16} />}>
                        Student Login
                      </Button>
                    </Link>
                    <Link to="/club/login" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" size="lg" className="w-full border border-[oklch(100%_0_0_/_0.1)]" leftIcon={<Building2 size={16} />}>
                        Club Login
                      </Button>
                    </Link>
                    <Link to="/club/signup" onClick={() => setMobileOpen(false)}>
                      <Button variant="primary" size="lg" className="w-full shine-on-hover" rightIcon={<ChevronRight size={16} />}>
                        Start a Club — Free
                      </Button>
                    </Link>
                    <Link to="/student/signup" onClick={() => setMobileOpen(false)} className="text-center text-sm text-[var(--color-brand-cyan)] hover:underline py-1">
                      New student? Sign up free →
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
