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
import { getAuthCallbackUrl, getResetPasswordUrl } from '@/lib/canonicalUrl'
import type { UserRole, Profile, ClubProfile, StudentProfile, ClubMemberRecord } from '@/types'

export interface SignUpClubParams {
  name: string
  clubName: string
  email: string
  password: string
  redirectTo?: string
}

export interface SignUpStudentParams {
  name: string
  email: string
  password: string
  redirectTo?: string
}

export interface AuthContextType {
  session: Session | null | undefined
  user: User | null
  profile: Profile | null
  clubProfile: ClubProfile | null
  studentProfile: StudentProfile | null
  clubMemberships: ClubMemberRecord[]
  activeClubMembership: ClubMemberRecord | null
  hasClubMembership: boolean
  activeClubId: string | null
  activeClubProfile: ClubProfile | null
  role: UserRole | null
  isLoading: boolean
  isRoleLoading: boolean
  profileError: string | null
  isConfigured: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: UserRole }>
  signUpClub: (params: SignUpClubParams) => Promise<{ error: string | null; requiresVerification: boolean }>
  signUpStudent: (params: SignUpStudentParams) => Promise<{ error: string | null; requiresVerification: boolean }>
  signOut: () => Promise<void>
  resendVerification: (email: string, redirectTo?: string) => Promise<{ error: string | null; success: boolean }>
  resetPassword: (email: string) => Promise<{ error: string | null; success: boolean }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null; success: boolean }>
  refreshProfile: () => Promise<void>
  updateProfile: (data: {
    displayName?: string
    collegeName?: string
    gradYear?: number | null
    phone?: string
    clubName?: string
    repName?: string
    description?: string
    websiteUrl?: string
    preferences?: Record<string, any>
  }) => Promise<{ error: string | null }>
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
  const [clubMemberships, setClubMemberships] = useState<ClubMemberRecord[]>([])
  const [activeClubMembership, setActiveClubMembership] = useState<ClubMemberRecord | null>(null)
  const [activeClubProfile, setActiveClubProfile] = useState<ClubProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRoleLoading, setIsRoleLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  // ── Fetch Profile from Supabase (Strict Database Source of Truth) ────────
  const fetchProfile = useCallback(async (userId: string, userMeta?: Record<string, unknown>) => {
    setIsRoleLoading(true)
    setProfileError(null)
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (error) {
          console.error('[FestFlow Security] Profile authorization query failed:', error.message)
          setProfile(null)
          setClubProfile(null)
          setStudentProfile(null)
          setClubMemberships([])
          setActiveClubMembership(null)
          setActiveClubProfile(null)
          setProfileError(error.message || 'Failed to verify account authorization.')
          return
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

          // Fetch active club memberships for role and organization coexistence
          try {
            const { data: memberRows, error: mErr } = await (supabase.from('club_members') as any)
              .select('*')
              .eq('user_id', userId)
              .eq('status', 'active')

            if (!mErr && memberRows && memberRows.length > 0) {
              const typedMembers = memberRows as ClubMemberRecord[]
              setClubMemberships(typedMembers)
              const primaryMembership = typedMembers[0]
              setActiveClubMembership(primaryMembership)

              const { data: cOrgData } = await (supabase.from('club_profiles') as any)
                .select('*')
                .eq('profile_id', primaryMembership.club_id)
                .maybeSingle()
              if (cOrgData) {
                setActiveClubProfile(cOrgData as unknown as ClubProfile)
              } else {
                setActiveClubProfile(null)
              }
            } else {
              setClubMemberships([])
              setActiveClubMembership(null)
              setActiveClubProfile(null)
            }
          } catch (mCatchErr) {
            console.warn('[FestFlow Auth] Club members lookup warning:', mCatchErr)
            setClubMemberships([])
            setActiveClubMembership(null)
            setActiveClubProfile(null)
          }
        } else {
          // Profile missing in database — fail closed to prevent metadata privilege escalation
          console.warn('[FestFlow Security] No database profile found for user:', userId)
          setProfile(null)
          setClubProfile(null)
          setStudentProfile(null)
          setClubMemberships([])
          setActiveClubMembership(null)
          setActiveClubProfile(null)
          setProfileError('Account profile record not found in database.')
        }
      } else {
        // Offline / Simulation Mode (Development only)
        if (userMeta) {
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

          // Check simulation club memberships
          try {
            const rawMembers = localStorage.getItem('festflow_club_members')
            if (rawMembers) {
              const parsedMembers = JSON.parse(rawMembers) as ClubMemberRecord[]
              const activeMembers = parsedMembers.filter(
                (m) => m.user_id === userId && m.status === 'active'
              )
              setClubMemberships(activeMembers)
              if (activeMembers.length > 0) {
                setActiveClubMembership(activeMembers[0])
              } else {
                setActiveClubMembership(null)
                setActiveClubProfile(null)
              }
            } else {
              setClubMemberships([])
              setActiveClubMembership(null)
              setActiveClubProfile(null)
            }
          } catch {
            setClubMemberships([])
            setActiveClubMembership(null)
            setActiveClubProfile(null)
          }
        }
      }
    } catch (err) {
      console.error('[FestFlow Auth] Error fetching profile:', err)
      setProfileError(err instanceof Error ? err.message : 'Authorization lookup failed')
    } finally {
      setIsRoleLoading(false)
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
          setClubMemberships([])
          setActiveClubMembership(null)
          setActiveClubProfile(null)
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
    if (isSupabaseConfigured) {
      try {
        const { data: { user: freshUser } } = await supabase.auth.getUser()
        if (freshUser) {
          setUser(freshUser)
          await fetchProfile(freshUser.id, freshUser.user_metadata)
          return
        }
      } catch (err) {
        console.warn('[FestFlow Auth] Failed to fetch current user session:', err)
      }
    } else {
      // Local simulation mode re-sync
      try {
        const stored = localStorage.getItem(MOCK_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as SimulatedAuthData
          setUser(parsed.user as unknown as User)
          setProfile(parsed.profile)
          if (parsed.studentProfile !== undefined) setStudentProfile(parsed.studentProfile)
          if (parsed.clubProfile !== undefined) setClubProfile(parsed.clubProfile)
        }
      } catch {
        // ignore
      }
    }

    if (user?.id) {
      await fetchProfile(user.id, user.user_metadata)
    }
  }, [user, fetchProfile])

  // ── Update Profile & Settings ──────────────────────────────────────────────
  const updateProfile = useCallback(
    async (params: {
      displayName?: string
      collegeName?: string
      gradYear?: number | null
      phone?: string
      clubName?: string
      repName?: string
      description?: string
      websiteUrl?: string
      preferences?: Record<string, any>
    }): Promise<{ error: string | null }> => {
      try {
        if (!user?.id) {
          return { error: 'No active authenticated user session found.' }
        }

        if (isSupabaseConfigured) {
          // 1. Update profiles table if displayName provided
          if (params.displayName !== undefined) {
            const { error: pErr } = await (supabase.from('profiles') as any)
              .update({
                display_name: params.displayName.trim(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', user.id)
            if (pErr) return { error: pErr.message }
          }

          // 2. Update student_profiles table if student fields provided
          if (params.collegeName !== undefined || params.gradYear !== undefined) {
            const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
            if (params.collegeName !== undefined) updatePayload.college_name = params.collegeName?.trim() || null
            if (params.gradYear !== undefined) updatePayload.graduation_year = params.gradYear

            const { error: sErr } = await (supabase.from('student_profiles') as any)
              .update(updatePayload)
              .eq('profile_id', user.id)
            if (sErr) return { error: sErr.message }
          }

          // 3. Update club_profiles table if club fields provided
          if (
            params.clubName !== undefined ||
            params.repName !== undefined ||
            params.description !== undefined ||
            params.websiteUrl !== undefined
          ) {
            const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() }
            if (params.clubName !== undefined) updatePayload.club_name = params.clubName.trim()
            if (params.repName !== undefined) updatePayload.representative_name = params.repName.trim()
            if (params.description !== undefined) updatePayload.description = params.description?.trim() || null
            if (params.websiteUrl !== undefined) updatePayload.website_url = params.websiteUrl?.trim() || null

            const { error: cErr } = await (supabase.from('club_profiles') as any)
              .update(updatePayload)
              .eq('profile_id', user.id)
            if (cErr) return { error: cErr.message }
          }

          // 4. Update Supabase Auth user_metadata
          const metadataUpdates: Record<string, any> = {}
          if (params.displayName !== undefined) metadataUpdates.display_name = params.displayName.trim()
          if (params.collegeName !== undefined) metadataUpdates.college = params.collegeName?.trim() || null
          if (params.gradYear !== undefined) metadataUpdates.graduation_year = params.gradYear
          if (params.phone !== undefined) metadataUpdates.phone = params.phone?.trim() || null
          if (params.clubName !== undefined) metadataUpdates.club_name = params.clubName.trim()
          if (params.preferences !== undefined) metadataUpdates.preferences = params.preferences

          if (Object.keys(metadataUpdates).length > 0) {
            const { error: authErr } = await supabase.auth.updateUser({
              data: metadataUpdates,
            })
            if (authErr) return { error: authErr.message }
          }

          // 5. Refresh user session and profiles
          await refreshProfile()
          return { error: null }
        } else {
          // Offline / Local Simulation Mode (Development only)
          const stored = localStorage.getItem(MOCK_STORAGE_KEY)
          if (stored) {
            const parsed = JSON.parse(stored) as SimulatedAuthData
            if (params.displayName !== undefined) {
              parsed.profile.display_name = params.displayName.trim()
              parsed.user.user_metadata.display_name = params.displayName.trim()
            }
            if (params.phone !== undefined) {
              ;(parsed.user.user_metadata as any).phone = params.phone?.trim() || ''
            }
            if (params.collegeName !== undefined || params.gradYear !== undefined) {
              if (!parsed.studentProfile) {
                parsed.studentProfile = {
                  id: `sp_${user.id}`,
                  profile_id: user.id,
                  college_name: null,
                  graduation_year: null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              }
              if (params.collegeName !== undefined) {
                parsed.studentProfile.college_name = params.collegeName?.trim() || null
                ;(parsed.user.user_metadata as any).college = params.collegeName?.trim() || ''
              }
              if (params.gradYear !== undefined) {
                parsed.studentProfile.graduation_year = params.gradYear
                ;(parsed.user.user_metadata as any).graduation_year = params.gradYear
              }
            }
            if (
              params.clubName !== undefined ||
              params.repName !== undefined ||
              params.description !== undefined ||
              params.websiteUrl !== undefined
            ) {
              if (!parsed.clubProfile) {
                parsed.clubProfile = {
                  id: `cp_${user.id}`,
                  profile_id: user.id,
                  club_name: 'Campus Club',
                  representative_name: parsed.profile.display_name,
                  website_url: null,
                  description: null,
                  is_verified: false,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              }
              if (params.clubName !== undefined) {
                parsed.clubProfile.club_name = params.clubName.trim()
                parsed.user.user_metadata.club_name = params.clubName.trim()
              }
              if (params.repName !== undefined) {
                parsed.clubProfile.representative_name = params.repName.trim()
              }
              if (params.description !== undefined) {
                parsed.clubProfile.description = params.description?.trim() || null
              }
              if (params.websiteUrl !== undefined) {
                parsed.clubProfile.website_url = params.websiteUrl?.trim() || null
              }
            }
            if (params.preferences !== undefined) {
              ;(parsed.user.user_metadata as any).preferences = params.preferences
            }

            localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(parsed))
            setUser(parsed.user as unknown as User)
            setProfile(parsed.profile)
            if (parsed.studentProfile) setStudentProfile(parsed.studentProfile)
            if (parsed.clubProfile) setClubProfile(parsed.clubProfile)
          }

          return { error: null }
        }
      } catch (err: any) {
        return { error: err?.message || 'Failed to update profile settings.' }
      }
    },
    [user, refreshProfile]
  )

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
      redirectTo,
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
              emailRedirectTo: getAuthCallbackUrl(redirectTo),
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
      redirectTo,
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
              emailRedirectTo: getAuthCallbackUrl(redirectTo),
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
    async (email: string, redirectTo?: string): Promise<{ error: string | null; success: boolean }> => {
      try {
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: {
              emailRedirectTo: getAuthCallbackUrl(redirectTo),
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

  // ── Reset Password Request ────────────────────────────────────────────────
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: string | null; success: boolean }> => {
      try {
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: getResetPasswordUrl(),
          })
          if (error) return { error: error.message, success: false }
          return { error: null, success: true }
        } else {
          await new Promise((r) => setTimeout(r, 600))
          return { error: null, success: true }
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Failed to send password reset request',
          success: false,
        }
      }
    },
    []
  )

  // ── Update Password ───────────────────────────────────────────────────────
  const updatePassword = useCallback(
    async (newPassword: string): Promise<{ error: string | null; success: boolean }> => {
      try {
        if (isSupabaseConfigured) {
          const { error } = await supabase.auth.updateUser({ password: newPassword })
          if (error) return { error: error.message, success: false }
          return { error: null, success: true }
        } else {
          await new Promise((r) => setTimeout(r, 600))
          return { error: null, success: true }
        }
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : 'Failed to update password',
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
      setClubMemberships([])
      setActiveClubMembership(null)
      setActiveClubProfile(null)
      setProfileError(null)
      setIsRoleLoading(false)
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
    clubMemberships,
    activeClubMembership,
    hasClubMembership: Boolean(
      clubMemberships.length > 0 ||
      clubProfile !== null ||
      (isSupabaseConfigured
        ? profile?.role === 'club_member'
        : profile?.role === 'club_member' || (user?.user_metadata?.role as UserRole) === 'club_member')
    ),
    activeClubId: clubProfile?.profile_id || activeClubMembership?.club_id || null,
    activeClubProfile,
    role: isSupabaseConfigured
      ? (profile?.role ?? null)
      : (profile?.role ?? (user?.user_metadata?.role as UserRole) ?? null),
    isLoading,
    isRoleLoading,
    profileError,
    isConfigured: isSupabaseConfigured,
    signIn,
    signUpClub,
    signUpStudent,
    signOut,
    resendVerification,
    resetPassword,
    updatePassword,
    refreshProfile,
    updateProfile,
    setDemoUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
