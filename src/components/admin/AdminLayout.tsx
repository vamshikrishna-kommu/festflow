// Phase 7: Super Admin Dashboard Layout Component
import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  LayoutDashboard,
  Building2,
  Users2,
  GraduationCap,
  CalendarCheck,
  ShieldAlert,
  Megaphone,
  CreditCard,
  Settings,
  History,
  UserCog,
  Menu,
  X,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Search,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/ui'

interface AdminLayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

interface NavItem {
  name: string
  path: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  badge?: string
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const navItems: NavItem[] = [
    { name: 'Dashboard Overview', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'College Directory', path: '/admin/colleges', icon: Building2 },
    { name: 'Clubs & Verification', path: '/admin/clubs', icon: Users2 },
    { name: 'Student Accounts', path: '/admin/students', icon: GraduationCap },
    { name: 'Event Moderation', path: '/admin/events', icon: CalendarCheck },
    { name: 'Abuse & Reports', path: '/admin/reports', icon: ShieldAlert },
    { name: 'Announcements', path: '/admin/announcements', icon: Megaphone },
    { name: 'Financial Oversight', path: '/admin/finances', icon: CreditCard },
    { name: 'Platform Settings', path: '/admin/settings', icon: Settings },
    { name: 'Notifications & Automation', path: '/admin/automation', icon: Zap },
    { name: 'Audit Trail', path: '/admin/audit-logs', icon: History },
    { name: 'Admin Team', path: '/admin/team', icon: UserCog },
  ]

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    // Route to search query in clubs or events
    navigate(`/admin/events?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  return (
    <div className="min-h-screen bg-[#08080A] text-[#F3F4F6] flex flex-col antialiased selection:bg-[#18CFFC]/20 selection:text-[#18CFFC]">
      {/* Top Banner / Emergency Indicator */}
      <div className="h-1 bg-gradient-to-r from-[#18CFFC] via-[#7F1AFB] to-[#ED47FC] w-full" />

      <div className="flex flex-1 relative overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`
            fixed lg:static top-0 bottom-0 left-0 z-50
            w-72 bg-[#0B0C10] border-r border-white/5
            flex flex-col transition-transform duration-300 ease-in-out
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Logo & Brand */}
          <div className="h-18 px-6 flex items-center justify-between border-b border-white/5">
            <Link to="/admin/dashboard" className="flex items-center gap-2.5">
              <Logo variant="navbar" />
              <span className="text-[10px] uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded-full bg-[#18CFFC]/10 text-[#18CFFC] border border-[#18CFFC]/30">
                ADMIN
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {/* Super Admin Identity Badge */}
          <div className="p-4 mx-3 my-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#18CFFC]/20 to-[#7F1AFB]/30 border border-[#18CFFC]/40 flex items-center justify-center text-[#18CFFC] shadow-lg shadow-[#18CFFC]/10 font-bold">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">
                {profile?.display_name || 'Super Administrator'}
              </div>
              <div className="text-[10px] text-white/50 font-mono truncate">
                {profile?.email || 'admin@festflow.online'}
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive =
                location.pathname === item.path ||
                (item.path === '/admin/dashboard' && location.pathname === '/admin')

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`
                    flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all
                    ${
                      isActive
                        ? 'bg-gradient-to-r from-[#18CFFC]/15 to-[#7F1AFB]/10 text-[#18CFFC] border border-[#18CFFC]/30 shadow-sm'
                        : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                    }
                  `}
                >
                  <Icon size={16} className={isActive ? 'text-[#18CFFC]' : 'text-white/50'} />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Bottom Shortcuts */}
          <div className="p-4 border-t border-white/5 space-y-2">
            <Link
              to="/discover"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2">
                <ExternalLink size={14} />
                Live FestFlow Portal
              </span>
              <span className="text-[10px] text-white/40 font-mono">↗</span>
            </Link>

            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut size={14} />
              Sign Out from Admin
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#08080A] overflow-y-auto min-h-screen">
          {/* Header Bar */}
          <header className="h-18 px-6 lg:px-8 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#08080A]/90 backdrop-blur-md z-30">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
                aria-label="Open sidebar menu"
              >
                <Menu size={20} />
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs text-white/40 font-mono">
                <span>FestFlow Admin</span>
                <span>/</span>
                <span className="text-white/80">{title}</span>
              </div>
            </div>

            {/* Quick Search */}
            <form onSubmit={handleGlobalSearch} className="relative hidden md:block w-72">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Global admin lookup…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#18CFFC]/50 transition-colors"
              />
            </form>
          </header>

          {/* Page Body */}
          <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-8">
            {/* Page Title & Actions Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/5">
              <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-display">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-xs sm:text-sm text-white/50 mt-1 max-w-2xl leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
            </div>

            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

