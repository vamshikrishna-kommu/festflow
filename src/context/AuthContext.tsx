import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import type { UserRole, Profile, ClubProfile, StudentProfile } from '@/types'

export interface SignUpClubParams {
  name: string
  clubName: string
  email: string
  password: string
}

export interface SignUpStudentParams {
  name: string
  email: string
  password: string
}

export interface AuthContextType {
  session: Session | null | undefined
  user: User | null
  profile: Profile | null
  clubProfile: ClubProfile | null
  studentProfile: StudentProfile | null
  role: UserRole | null
  isLoading: boolean
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: UserRole }>
  signUpClub: (params: SignUpClubParams) => Promise<{ error: string | null; requiresVerification: boolean }>
  signUpStudent: (params: SignUpStudentParams) => Promise<{ error: string | null; requiresVerification: boolean }>
  signOut: () => Promise<void>
  resendVerification: (email: string) => Promise<{ error: string | null; success: boolean }>
  refreshProfile: () => Promise<void>
  // Demo simulation helper for testing when Supabase is not yet connected
  setDemoUser: (role: 'club_member' | 'student') => void
}

const AuthContext = createContext<AuthContextType | null>(null)

const MOCK_STORAGE_KEY = 'festflow_simulated_auth'

interface SimulatedAuthData {
  user: {
    id: string
    email: string
    user_metadata: {
      role: UserRole
      display_name: string
      club_name?: string
    }
    email_confirmed_at: string | null
  }
  profile: Profile
  clubProfile?: ClubProfile | null
  studentProfile?: StudentProfile | null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clubProfile, setClubProfile] = useState<ClubProfile | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ── Fetch Profile from Supabase ───────────────────────────────────────────
  const fetchProfile = useCallback(async (userId: string, userMeta?: Record<string, unknown>) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('[FestFlow Auth] Profile query notice:', error.message)
      }

      const profileData = data as unknown as Profile | null
      if (profileData) {
        setProfile(profileData)
        if (profileData.role === 'club_member') {
          const { data: cData } = await supabase
            .from('club_profiles')
            .select('*')
            .eq('profile_id', userId)
            .maybeSingle()
          setClubProfile((cData as unknown as ClubProfile | null) ?? null)
        } else if (profileData.role === 'student') {
          const { data: sData } = await supabase
            .from('student_profiles')
            .select('*')
            .eq('profile_id', userId)
            .maybeSingle()
          setStudentProfile((sData as unknown as StudentProfile | null) ?? null)
        }
      } else if (userMeta) {
        // Fallback profile if database triggers haven't executed yet or in transition
        const fallbackRole = (userMeta.role as UserRole) || 'student'
        const fallbackProfile: Profile = {
          id: userId,
          role: fallbackRole,
          display_name: (userMeta.display_name as string) || 'FestFlow Member',
          email: (userMeta.email as string) || '',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setProfile(fallbackProfile)
        if (fallbackRole === 'club_member') {
          setClubProfile({
            id: `cp_${userId}`,
            profile_id: userId,
            club_name: (userMeta.club_name as string) || 'Campus Club',
            representative_name: fallbackProfile.display_name,
            website_url: null,
            description: null,
            is_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }
    } catch (err) {
      console.error('[FestFlow Auth] Error fetching profile:', err)
    }
  }, [])

  // ── Initialize Auth State ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (!mounted) return
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        if (initialSession?.user) {
          fetchProfile(initialSession.user.id, initialSession.user.user_metadata).finally(() => {
            if (mounted) setIsLoading(false)
          })
        } else {
          setIsLoading(false)
        }
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!mounted) return
        setSession(newSession)
        setUser(newSession?.user ?? null)
        if (newSession?.user) {
          fetchProfile(newSession.user.id, newSession.user.user_metadata)
        } else {
          setProfile(null)
          setClubProfile(null)
          setStudentProfile(null)
        }
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    } else {
      // In Production, NEVER silently load fake authentication
      if (isProduction) {
        setSession(null)
        setUser(null)
        setProfile(null)
        setClubProfile(null)
        setStudentProfile(null)
        setIsLoading(false)
        return
      }

      // Offline / Local Simulation Mode (Development only)
      try {
        const stored = localStorage.getItem(MOCK_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as SimulatedAuthData
          setUser(parsed.user as unknown as User)
          setSession({
            access_token: 'mock_token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'mock_refresh',
            user: parsed.user as unknown as User,
          })
          setProfile(parsed.profile)
          setClubProfile(parsed.clubProfile ?? null)
          setStudentProfile(parsed.studentProfile ?? null)
        } else {
          setSession(null)
          setUser(null)
        }
      } catch {
        setSession(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
  }, [fetchProfile])

  // ── Refresh Profile ───────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.user_metadata)
    }
  }, [user, fetchProfile])

  // ── Sign In ───────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null; role?: UserRole }> => {
      setIsLoading(true)
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (error) {
            setIsLoading(false)
            return { error: error.message }
          }

          if (data.user) {
            setUser(data.user)
            setSession(data.session)
            await fetchProfile(data.user.id, data.user.user_metadata)
            const role = (data.user.user_metadata?.role as UserRole) || 'student'
            setIsLoading(false)
            return { error: null, role }
          }
          setIsLoading(false)
          return { error: 'Unknown authentication response' }
        } else {
          // Block simulated sign-in if in production
          if (isProduction) {
            setIsLoading(false)
            return {
              error: 'Production Configuration Error: Supabase backend is not configured. Live credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) must be provided in deployment environment settings.',
            }
          }

          // Simulation mode: Check registered mock user or accept demo login (Development only)
          await new Promise((r) => setTimeout(r, 600)) // smooth realistic delay

          // If email looks like club or user previously signed up as club
          const isClubEmail = email.toLowerCase().includes('club') || email.toLowerCase().includes('fest')
          const assignedRole: UserRole = isClubEmail ? 'club_member' : 'student'
          const name = email.split('@')[0].replace(/[._-]/g, ' ')
          const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1)

          const mockData: SimulatedAuthData = {
            user: {
              id: 'demo-user-id-' + Date.now(),
              email,
              user_metadata: {
                role: assignedRole,
                display_name: capitalizedName,
                club_name: isClubEmail ? `${capitalizedName} Association` : undefined,
              },
              email_confirmed_at: new Date().toISOString(),
            },
            profile: {
              id: 'demo-user-id-' + Date.now(),
              role: assignedRole,
              display_name: capitalizedName,
              email,
              avatar_url: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            clubProfile: isClubEmail
              ? {
                  id: 'cp_demo',
                  profile_id: 'demo-user-id-' + Date.now(),
                  club_name: `${capitalizedName} Association`,
                  representative_name: capitalizedName,
                  website_url: 'https://example.com',
                  description: 'Campus organizer community.',
                  is_verified: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : null,
            studentProfile: !isClubEmail
              ? {
                  id: 'sp_demo',
                  profile_id: 'demo-user-id-' + Date.now(),
                  college_name: 'National Institute of Technology',
                  graduation_year: 2026,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : null,
          }

          localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockData))
          setUser(mockData.user as unknown as User)
          setSession({
            access_token: 'mock_token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'mock_refresh',
            user: mockData.user as unknown as User,
          })
          setProfile(mockData.profile)
          setClubProfile(mockData.clubProfile ?? null)
          setStudentProfile(mockData.studentProfile ?? null)
          setIsLoading(false)
          return { error: null, role: assignedRole }
        }
      } catch (err) {
        setIsLoading(false)
        return { error: err instanceof Error ? err.message : 'Authentication failed' }
      }
    },
    [fetchProfile]
  )

  // ── Sign Up Club ──────────────────────────────────────────────────────────
  const signUpClub = useCallback(
    async ({
      name,
      clubName,
      email,
      password,
    }: SignUpClubParams): Promise<{ error: string | null; requiresVerification: boolean }> => {
      setIsLoading(true)
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                role: 'club_member',
                display_name: name,
                club_name: clubName,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })

          if (error) {
            setIsLoading(false)
            return { error: error.message, requiresVerification: false }
          }

          // If email confirmation is required, session might be null
          const requiresVerification = !data.session
          setIsLoading(false)
          return { error: null, requiresVerification }
        } else {
          // Block simulated sign-up in production
          if (isProduction) {
            setIsLoading(false)
            return {
              error: 'Production Configuration Error: Live Supabase backend is not configured. Account registration is unavailable.',
              requiresVerification: false,
            }
          }
          // Simulation mode (Development only)
          await new Promise((r) => setTimeout(r, 700))
          setIsLoading(false)
          return { error: null, requiresVerification: true }
        }
      } catch (err) {
        setIsLoading(false)
        return {
          error: err instanceof Error ? err.message : 'Registration failed',
          requiresVerification: false,
        }
      }
    },
    []
  )

  // ── Sign Up Student ───────────────────────────────────────────────────────
  const signUpStudent = useCallback(
    async ({
      name,
      email,
      password,
    }: SignUpStudentParams): Promise<{ error: string | null; requiresVerification: boolean }> => {
      setIsLoading(true)
      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                role: 'student',
                display_name: name,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })

          if (error) {
            setIsLoading(false)
            return { error: error.message, requiresVerification: false }
          }

          const requiresVerification = !data.session
          setIsLoading(false)
          return { error: null, requiresVerification }
        } else {
          // Block simulated student registration in production
          if (isProduction) {
            setIsLoading(false)
            return {
              error: 'Production Configuration Error: Live Supabase backend is not configured. Account registration is unavailable.',
              requiresVerification: false,
            }
          }
          // Simulation mode (Development only)
          await new Promise((r) => setTimeout(r, 650))
          setIsLoading(false)
          return { error: null, requiresVerification: true }
        }
      } catch (err) {
        setIsLoading(false)
        return {
          error: err instanceof Error ? err.message : 'Student registration failed',
          requiresVerification: false,
        }
      }
    },
    []
  )

  // ── Resend Verification Email ─────────────────────────────────────────────
  const resendVerification = useCallback(
    async (email: string): Promise<{ error: string | null; success: boolean }> => {
      try {
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          })
          if (error) return { error: error.message, success: false }
          return { error: null, success: true }
        } else {
          await new Promise((r) => setTimeout(r, 500))
          return { error: null, success: true }
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Failed to resend verification email',
          success: false,
        }
      }
    },
    []
  )

  // ── Sign Out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    setIsLoading(true)
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut()
      } else {
        localStorage.removeItem(MOCK_STORAGE_KEY)
      }
      setSession(null)
      setUser(null)
      setProfile(null)
      setClubProfile(null)
      setStudentProfile(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Fast Demo Sign-In Helper (Development Only) ─────────────────────────
  const setDemoUser = useCallback((targetRole: 'club_member' | 'student') => {
    if (isProduction) {
      console.error('[FestFlow Security Safeguard] Demo logins are permanently disabled in production builds.')
      return
    }

    const isClub = targetRole === 'club_member'
    const name = isClub ? 'Sarah Chen' : 'Alex Rivera'
    const email = isClub ? 'organizer@robotics-club.edu' : 'alex.rivera@campus.edu'
    const demoId = `demo_${targetRole}_${Date.now()}`

    const demoData: SimulatedAuthData = {
      user: {
        id: demoId,
        email,
        user_metadata: {
          role: targetRole,
          display_name: name,
          club_name: isClub ? 'Robotics & AI Club' : undefined,
        },
        email_confirmed_at: new Date().toISOString(),
      },
      profile: {
        id: demoId,
        role: targetRole,
        display_name: name,
        email,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      clubProfile: isClub
        ? {
            id: `cp_${demoId}`,
            profile_id: demoId,
            club_name: 'Robotics & AI Club',
            representative_name: name,
            website_url: 'https://robotics-festflow.edu',
            description: 'Premier student robotics team and hackathon host.',
            is_verified: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : null,
      studentProfile: !isClub
        ? {
            id: `sp_${demoId}`,
            profile_id: demoId,
            college_name: 'State Tech University',
            graduation_year: 2026,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : null,
    }

    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(demoData))
    setUser(demoData.user as unknown as User)
    setSession({
      access_token: 'mock_token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'mock_refresh',
      user: demoData.user as unknown as User,
    })
    setProfile(demoData.profile)
    setClubProfile(demoData.clubProfile ?? null)
    setStudentProfile(demoData.studentProfile ?? null)
    setIsLoading(false)
  }, [])

  const value: AuthContextType = {
    session,
    user,
    profile,
    clubProfile,
    studentProfile,
    role: profile?.role ?? (user?.user_metadata?.role as UserRole) ?? null,
    isLoading,
    isConfigured: isSupabaseConfigured,
    signIn,
    signUpClub,
    signUpStudent,
    signOut,
    resendVerification,
    refreshProfile,
    setDemoUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
