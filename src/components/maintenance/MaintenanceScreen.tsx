import { useState, type FormEvent } from 'react'
import { Wrench, RefreshCw, Mail, Phone, Shield, ArrowRight, Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/ui'
import { useMaintenance } from '@/context/MaintenanceContext'
import { useAuth } from '@/context/AuthContext'

export function MaintenanceScreen() {
  const { supportEmail, supportPhone, isChecking, refreshMaintenanceStatus } = useMaintenance()
  const { signIn, role, user, signOut } = useAuth()

  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null)

  const handleRefresh = async () => {
    setRefreshNotice(null)
    const isStillOn = await refreshMaintenanceStatus()
    if (!isStillOn) {
      setRefreshNotice('Maintenance mode has concluded! Restoring access...')
    } else {
      setRefreshNotice('Maintenance is still in progress. Thank you for your patience!')
      setTimeout(() => setRefreshNotice(null), 4000)
    }
  }

  const handleAdminSignIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!adminEmail || !adminPassword) {
      setLoginError('Please enter both email and password.')
      return
    }

    setLoginLoading(true)
    setLoginError(null)

    try {
      const res = await signIn(adminEmail, adminPassword)
      if (res.error) {
        setLoginError(res.error)
      } else if (res.role !== 'platform_admin') {
        setLoginError('Account verified, but platform administrator privileges are required to bypass maintenance mode.')
      } else {
        // Successfully logged in as platform_admin! State will update automatically.
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Please check credentials.')
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--color-canvas)] text-gray-900 flex flex-col justify-between relative overflow-hidden select-none">
      {/* Top Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <Logo variant="navbar" />
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold tracking-wide uppercase">
          <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
          <span>Platform Maintenance</span>
        </div>
      </header>

      {/* Main Hero Notice */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center max-w-2xl mx-auto z-10">
        {/* Icon Badge */}
        <div className="relative mb-8">
          <div className="relative w-20 h-20 rounded-3xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <Wrench className="w-9 h-9 text-blue-600 animate-[spin_10s_linear_infinite]" />
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight text-gray-900 mb-4">
          Under Scheduled <br className="hidden sm:inline" />
          <span className="text-blue-600">
            Maintenance
          </span>
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base text-gray-600 leading-relaxed mb-8 max-w-lg">
          FestFlow is currently undergoing essential infrastructure enhancements and database optimization to improve your campus festival experience. Services will be restored shortly.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isChecking}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking Platform Status...' : 'Check Status Again'}</span>
          </button>
        </div>

        {/* Notice feedback */}
        {refreshNotice && (
          <div className="mt-4 px-4 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800 animate-fade-in flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{refreshNotice}</span>
          </div>
        )}

        {/* Help / Support Links */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-500 border-t border-gray-200 pt-6 w-full">
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center gap-2 hover:text-gray-900 transition-colors"
            >
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>{supportEmail}</span>
            </a>
          )}
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="flex items-center gap-2 hover:text-gray-900 transition-colors"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>{supportPhone}</span>
            </a>
          )}
        </div>
      </main>

      {/* Administrator Bypass Portal Footer */}
      <footer className="w-full max-w-md mx-auto px-6 py-6 z-20">
        {!showAdminLogin ? (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowAdminLogin(true)}
              className="text-[11px] text-gray-500 hover:text-gray-900 transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
            >
              <Shield className="w-3 h-3" />
              <span>Administrator Portal Access</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-md animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-900">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                <span>Platform Administrator Sign-In</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminLogin(false)
                  setLoginError(null)
                }}
                className="text-xs text-gray-500 hover:text-gray-900 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {user && role !== 'platform_admin' && (
              <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div>Signed in as <strong>{user.email}</strong> ({role || 'attendee'}).</div>
                  <div className="text-[10px] text-amber-700 mt-0.5">Please sign out and sign in with an administrator account.</div>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className="mt-1.5 text-[11px] underline text-amber-900 hover:text-amber-700 font-medium cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {loginError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminSignIn} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Admin Email</label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@festflow.online"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 rounded-xl bg-gray-900 text-white font-semibold text-xs hover:bg-gray-800 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{loginLoading ? 'Authenticating...' : 'Sign In as Administrator'}</span>
                {!loginLoading && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </form>
          </div>
        )}
      </footer>
    </div>
  )
}
