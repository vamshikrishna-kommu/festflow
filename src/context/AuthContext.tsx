import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import { getAuthCallbackUrl, getResetPasswordUrl } from '@/lib/canonicalUrl'
import type {
  UserRole,
  Profile,
  ClubProfile,
  StudentProfile,
  ClubMemberRecord,
  ClubRole,
  ClubPermission,
  EventAssignmentRecord,
} from '@/types'
import {
  canAccessStudentWorkspace,
  canAccessClubWorkspace,
  isDualWorkspaceEligible,
  getWorkspaceFromPath,
  type WorkspaceType,
  type AvailableClub,
} from '@/lib/workspace'
import { hasPermission, hasEventPermission as hasEventPermissionHelper } from '@/lib/rbac'
import { getUserEventAssignments } from '@/lib/eventAssignments'
import { broadcastStatusChange, subscribeToStatusChanges } from '@/lib/sync'
import { clearAllUserTicketCaches, reconcileTicketCacheOwner } from '@/lib/ticketCache'

export interface SignUpClubParams {
  name: string
  clubName: string
  email: string
  password: string
  collegeId?: string | null
  collegeName?: string | null
  redirectTo?: string
}

export interface SignUpStudentParams {
  name: string
  email: string
  password: string
  collegeId?: string | null
  collegeName?: string | null
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
  eventAssignments: EventAssignmentRecord[]
  hasClubMembership: boolean
  activeClubId: string | null
  activeClubProfile: ClubProfile | null
  activeWorkspace: WorkspaceType
  isDualEligible: boolean
  availableClubs: AvailableClub[]
  activeClubRole: ClubRole | null
  hasClubPermission: (permission: ClubPermission) => boolean
  hasEventPermission: (eventId: string, permission: ClubPermission, eventClubId?: string | null) => boolean
  role: UserRole | null
  isLoading: boolean
  isRoleLoading: boolean
  profileError: string | null
  isConfigured: boolean
  switchWorkspace: (target: WorkspaceType, navigate?: (path: string) => void) => void
  switchActiveClub: (clubId: string) => Promise<boolean>
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: UserRole }>
  signInWithGoogle: (options?: { redirectTo?: string; role?: UserRole }) => Promise<{ error: string | null }>
  signUpClub: (params: SignUpClubParams) => Promise<{ error: string | null; requiresVerification: boolean }>
  signUpStudent: (params: SignUpStudentParams) => Promise<{ error: string | null; requiresVerification: boolean }>
  signOut: () => Promise<void>
  resendVerification: (email: string, redirectTo?: string) => Promise<{ error: string | null; success: boolean }>
  resetPassword: (email: string) => Promise<{ error: string | null; success: boolean }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null; success: boolean }>
  refreshProfile: () => Promise<void>
  refreshMemberships: () => Promise<void>
  updateProfile: (data: {
    displayName?: string
    collegeName?: string
    collegeId?: string | null
    gradYear?: number | null
    phone?: string
    clubName?: string
    repName?: string
    description?: string
    websiteUrl?: string
    preferences?: Record<string, any>
  }) => Promise<{ error: string | null }>
  // Demo simulation helper for testing when Supabase is not yet connected
  setDemoUser: (role: 'club_member' | 'student' | 'platform_admin') => void
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

const PLATFORM_ADMIN_EMAILS = ['vamshikrishnakommu0908@gmail.com']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clubProfile, setClubProfile] = useState<ClubProfile | null>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [clubMemberships, setClubMemberships] = useState<ClubMemberRecord[]>([])
  const [legacyOwnedClub, setLegacyOwnedClub] = useState<ClubProfile | null>(null)
  const [activeClubMembership, setActiveClubMembership] = useState<ClubMemberRecord | null>(null)
  const [activeClubProfile, setActiveClubProfile] = useState<ClubProfile | null>(null)
  const [eventAssignments, setEventAssignments] = useState<EventAssignmentRecord[]>([])
  const [preferredWorkspace, setPreferredWorkspace] = useState<WorkspaceType>(() => {
    try {
      const stored = sessionStorage.getItem('festflow_active_workspace')
      if (stored === 'student' || stored === 'club') return stored
    } catch {
      // ignore
    }
    return 'student'
  })
  const [preferredClubId, setPreferredClubId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('festflow_preferred_club_id')
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isRoleLoading, setIsRoleLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const profileRef = useRef<Profile | null>(null)
  const preferredClubIdRef = useRef<string | null>(preferredClubId)
  preferredClubIdRef.current = preferredClubId

  const clearWorkspaceAndAuthState = useCallback(() => {
    try {
      sessionStorage.removeItem('festflow_active_workspace')
      sessionStorage.removeItem('festflow_preferred_club_id')
    } catch {
      // ignore
    }
    preferredClubIdRef.current = null
    setPreferredClubId(null)
    setPreferredWorkspace('student')
    profileRef.current = null
    setProfile(null)
    setClubProfile(null)
    setLegacyOwnedClub(null)
    setStudentProfile(null)
    setClubMemberships([])
    setActiveClubMembership(null)
    setActiveClubProfile(null)
    setEventAssignments([])
    setProfileError(null)
    setIsRoleLoading(false)
  }, [])

  // ── Fetch Profile from Supabase (Strict Database Source of Truth) ────────
  const fetchProfile = useCallback(
    async (
      userId: string,
      userMeta?: Record<string, unknown>,
      silent = false,
      userSessionEmail?: string
    ): Promise<Profile | null> => {
      if (!silent) setIsRoleLoading(true)
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
          profileRef.current = null
          setProfile(null)
          setClubProfile(null)
          setLegacyOwnedClub(null)
          setStudentProfile(null)
          setClubMemberships([])
          setActiveClubMembership(null)
          setActiveClubProfile(null)
          setEventAssignments([])
          setProfileError(error.message || 'Failed to verify account authorization.')
          return null
        }

        let profileData = data as unknown as Profile | null

        // If user is authenticated in Supabase but their profiles row does not exist yet
        // (e.g. brand-new OAuth user whose trigger didn't fire or had a race condition),
        // safely initialize their default student profile.
        // SECURITY INVARIANT: ALWAYS assign 'student' - NEVER grant club privileges automatically.
        if (!profileData && userId) {
          try {
            const defaultName =
              (userMeta?.full_name as string) ||
              (userMeta?.name as string) ||
              (userMeta?.display_name as string) ||
              (userSessionEmail ? userSessionEmail.split('@')[0] : 'FestFlow Member')

            const { data: createdProfile, error: pCreateErr } = await (supabase.from('profiles') as any)
              .insert({
                id: userId,
                role: 'student',
                display_name: defaultName,
                email: userSessionEmail || '',
              })
              .select('*')
              .maybeSingle()

            if (!pCreateErr && createdProfile) {
              profileData = createdProfile as Profile
              await (supabase.from('student_profiles') as any)
                .insert({ profile_id: userId })
                .catch(() => {})
            }
          } catch (initErr) {
            console.warn('[FestFlow Auth] Initial OAuth profile creation fallback warning:', initErr)
          }
        }

        if (profileData) {
          const verifiedEmail = userSessionEmail || profileData.email || ''
          const isSuperAdminEmail =
            (verifiedEmail && PLATFORM_ADMIN_EMAILS.includes(verifiedEmail.toLowerCase().trim())) ||
            (userSessionEmail && PLATFORM_ADMIN_EMAILS.includes(userSessionEmail.toLowerCase().trim())) ||
            (profileData.email && PLATFORM_ADMIN_EMAILS.includes(profileData.email.toLowerCase().trim()))
          if (isSuperAdminEmail && profileData.role !== 'platform_admin') {
            profileData = { ...profileData, role: 'platform_admin' }
            try {
              void (supabase as any).rpc('bootstrap_initial_super_admin', {
                p_email: verifiedEmail.toLowerCase().trim(),
              })
            } catch {
              // Non-blocking
            }
          }

          profileRef.current = profileData
          setProfile(profileData)

          const subProfilePromise = (async (): Promise<ClubProfile | null> => {
            if (profileData.role === 'club_member') {
              const { data: cData } = await supabase
                .from('club_profiles')
                .select('*')
                .eq('profile_id', userId)
                .maybeSingle()
              const cp = (cData as unknown as ClubProfile | null) ?? null
              setClubProfile(cp)
              return cp
            } else if (profileData.role === 'student') {
              setClubProfile(null)
              const { data: sData } = await supabase
                .from('student_profiles')
                .select('*')
                .eq('profile_id', userId)
                .maybeSingle()
              if (sData) {
                const sp = sData as unknown as StudentProfile
                setStudentProfile({
                  ...sp,
                  college_name: sp.college_name || (userMeta?.college as string) || null,
                  graduation_year: sp.graduation_year || (userMeta?.graduation_year as number) || null,
                })
              } else {
                setStudentProfile({
                  id: `sp_${userId}`,
                  profile_id: userId,
                  college_name: (userMeta?.college as string) || null,
                  graduation_year: (userMeta?.graduation_year as number) || null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
              }
            }
            return null
          })()

          const membershipsPromise = (async (): Promise<{
            ok: boolean
            allRows: ClubMemberRecord[]
            enrichedActive: ClubMemberRecord[]
            errorMsg?: string
          }> => {
            try {
              const { data: memberRows, error: mErr } = await (supabase.from('club_members') as any)
                .select('*')
                .eq('user_id', userId)

              if (mErr) {
                console.error('[FestFlow Security] Club members query failed:', mErr.message)
                return {
                  ok: false,
                  allRows: [],
                  enrichedActive: [],
                  errorMsg: mErr.message || 'Failed to verify club memberships.',
                }
              }

              const allRows = (memberRows || []) as ClubMemberRecord[]
              const activeRows = allRows.filter((m) => m.status === 'active')
              if (activeRows.length === 0) {
                return { ok: true, allRows, enrichedActive: [] }
              }

              const clubIds = activeRows.map((m) => m.club_id)
              let enrichedActive: ClubMemberRecord[] = activeRows
              try {
                const { data: orgData } = await (supabase.from('club_profiles') as any)
                  .select('*')
                  .in('profile_id', clubIds)
                if (orgData && orgData.length > 0) {
                  const orgList = orgData as ClubProfile[]
                  enrichedActive = activeRows.map((m) => {
                    const org = orgList.find((o) => o.profile_id === m.club_id)
                    return {
                      ...m,
                      club: org || null,
                      club_name: org?.club_name || 'Campus Club',
                    }
                  })
                }
              } catch {
                // ignore org lookup enrichment failure
              }

              return { ok: true, allRows, enrichedActive }
            } catch (mCatchErr: any) {
              console.error('[FestFlow Security] Club members lookup exception:', mCatchErr)
              return {
                ok: false,
                allRows: [],
                enrichedActive: [],
                errorMsg: mCatchErr?.message || 'Club membership lookup failed.',
              }
            }
          })()

          const assignmentsPromise = getUserEventAssignments(userId)

          const [ownClubProfile, membershipsResult, assignmentsResult] = await Promise.all([
            subProfilePromise,
            membershipsPromise,
            assignmentsPromise,
          ])

          if (!membershipsResult.ok) {
            setClubMemberships([])
            setLegacyOwnedClub(null)
            setActiveClubMembership(null)
            setActiveClubProfile(null)
            setEventAssignments([])
            setProfileError(membershipsResult.errorMsg || 'Failed to verify club memberships.')
            return profileData
          }

          const { allRows, enrichedActive } = membershipsResult

          // Legacy owner fallback ONLY when club_profiles exists for userId, user has NO club_members
          // row for that club (e.g. removed/revoked/demoted), AND zero active owners exist in DB.
          let resolvedLegacyClub: ClubProfile | null = null
          if (
            ownClubProfile &&
            !allRows.some((m) => m.club_id === ownClubProfile.profile_id)
          ) {
            const { data: existingOwners, error: ownerCheckErr } = await (supabase.from('club_members') as any)
              .select('id')
              .eq('club_id', ownClubProfile.profile_id)
              .eq('role', 'owner')
              .eq('status', 'active')
              .limit(1)

            if (!ownerCheckErr && (!existingOwners || existingOwners.length === 0)) {
              resolvedLegacyClub = ownClubProfile
            }
          }

          setLegacyOwnedClub(resolvedLegacyClub)
          setClubMemberships(enrichedActive)

          const activeClubIdSet = new Set(enrichedActive.map((m) => m.club_id))
          if (resolvedLegacyClub) activeClubIdSet.add(resolvedLegacyClub.profile_id)

          if (assignmentsResult.error) {
            console.warn('[FestFlow Auth] Event assignments lookup warning:', assignmentsResult.error)
            setEventAssignments([])
          } else {
            setEventAssignments(
              (assignmentsResult.assignments || []).filter((a) => activeClubIdSet.has(a.club_id))
            )
          }

          const currentPref = preferredClubIdRef.current
          if (resolvedLegacyClub && currentPref === resolvedLegacyClub.profile_id) {
            setActiveClubMembership(null)
            setActiveClubProfile(resolvedLegacyClub)
          } else if (enrichedActive.length > 0) {
            const matched = currentPref
              ? enrichedActive.find((m) => m.club_id === currentPref)
              : null
            const selectedMembership = matched || enrichedActive[0]
            setActiveClubMembership(selectedMembership)
            if (selectedMembership.club) {
              setActiveClubProfile(selectedMembership.club)
            } else {
              const { data: cOrgData } = await (supabase.from('club_profiles') as any)
                .select('*')
                .eq('profile_id', selectedMembership.club_id)
                .maybeSingle()
              setActiveClubProfile(cOrgData ? (cOrgData as unknown as ClubProfile) : null)
            }
          } else if (resolvedLegacyClub) {
            setActiveClubMembership(null)
            setActiveClubProfile(resolvedLegacyClub)
          } else {
            setActiveClubMembership(null)
            setActiveClubProfile(null)
          }

          return profileData
        } else {
          // Profile missing in database — fail closed to prevent metadata privilege escalation
          console.warn('[FestFlow Security] No database profile found for user:', userId)
          profileRef.current = null
          setProfile(null)
          setClubProfile(null)
          setLegacyOwnedClub(null)
          setStudentProfile(null)
          setClubMemberships([])
          setActiveClubMembership(null)
          setActiveClubProfile(null)
          setEventAssignments([])
          setProfileError('Account profile record not found in database.')
          return null
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
          profileRef.current = fallbackProfile
          setProfile(fallbackProfile)

          let ownMockClub: ClubProfile | null = null
          if (fallbackRole === 'club_member') {
            ownMockClub = {
              id: `cp_${userId}`,
              profile_id: userId,
              club_name: (userMeta.club_name as string) || 'Campus Club',
              representative_name: fallbackProfile.display_name,
              website_url: null,
              description: null,
              is_verified: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
          }
          setClubProfile(ownMockClub)

          try {
            const rawMembers =
              localStorage.getItem('festflow_local_club_members') ||
              localStorage.getItem('festflow_club_members')
            const parsedMembers = rawMembers ? (JSON.parse(rawMembers) as ClubMemberRecord[]) : []
            const userAllRows = parsedMembers.filter((m) => m.user_id === userId)
            const activeMembers = userAllRows.filter((m) => m.status === 'active')

            let enriched = activeMembers
            try {
              const rawClubs = localStorage.getItem('festflow_local_clubs')
              if (rawClubs) {
                const parsedClubs = JSON.parse(rawClubs) as Array<{ id: string; name: string }>
                enriched = activeMembers.map((m) => {
                  const c = parsedClubs.find((cl) => cl.id === m.club_id)
                  return {
                    ...m,
                    club_name: c?.name || m.club_name || 'Campus Club',
                  }
                })
              }
            } catch {
              // ignore
            }

            const hasExplicitRowForOwnClub =
              ownMockClub !== null && userAllRows.some((m) => m.club_id === ownMockClub!.profile_id)
            const resolvedMockLegacy =
              ownMockClub && !hasExplicitRowForOwnClub ? ownMockClub : null

            setLegacyOwnedClub(resolvedMockLegacy)
            setClubMemberships(enriched)

            const { assignments } = await getUserEventAssignments(userId)
            setEventAssignments(assignments || [])

            const currentPref = preferredClubIdRef.current
            const matched = currentPref ? enriched.find((m) => m.club_id === currentPref) : null
            const selected = matched || (enriched.length > 0 ? enriched[0] : null)

            if (resolvedMockLegacy && currentPref === resolvedMockLegacy.profile_id) {
              setActiveClubMembership(null)
              setActiveClubProfile(resolvedMockLegacy)
            } else if (selected) {
              setActiveClubMembership(selected)
              setActiveClubProfile(
                selected.club || {
                  id: `cp_${selected.club_id}`,
                  profile_id: selected.club_id,
                  club_name: selected.club_name || 'Campus Club',
                  representative_name: fallbackProfile.display_name,
                  website_url: null,
                  description: null,
                  is_verified: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              )
            } else if (resolvedMockLegacy) {
              setActiveClubMembership(null)
              setActiveClubProfile(resolvedMockLegacy)
            } else {
              setActiveClubMembership(null)
              setActiveClubProfile(null)
            }
          } catch {
            setLegacyOwnedClub(null)
            setClubMemberships([])
            setActiveClubMembership(null)
            setActiveClubProfile(null)
            setEventAssignments([])
          }
          return fallbackProfile
        }
        return null
      }
    } catch (err) {
      console.error('[FestFlow Auth] Error fetching profile:', err)
      setProfileError(err instanceof Error ? err.message : 'Authorization lookup failed')
      return null
    } finally {
      if (!silent) setIsRoleLoading(false)
    }
  }, [])

  // ── Initialize Auth State ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        if (!mounted) return
        reconcileTicketCacheOwner(initialSession?.user?.id ?? null)
        setSession(initialSession)
        setUser(initialSession?.user ?? null)
        if (initialSession?.user) {
          fetchProfile(
            initialSession.user.id,
            initialSession.user.user_metadata,
            false,
            initialSession.user.email
          ).finally(() => {
            if (mounted) setIsLoading(false)
          })
        } else {
          setIsLoading(false)
        }
      })

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (!mounted) return
        if (event === 'SIGNED_OUT' || !newSession?.user) {
          clearAllUserTicketCaches()
          setSession(null)
          setUser(null)
          clearWorkspaceAndAuthState()
          return
        }

        reconcileTicketCacheOwner(newSession.user.id)
        const switchedAccount = Boolean(
          profileRef.current && profileRef.current.id !== newSession.user.id
        )
        if (switchedAccount) {
          clearWorkspaceAndAuthState()
        }

        setSession(newSession)
        setUser(newSession.user)
        const isSilent =
          event === 'TOKEN_REFRESHED' ||
          Boolean(profileRef.current && profileRef.current.id === newSession.user.id)
        fetchProfile(
          newSession.user.id,
          newSession.user.user_metadata,
          isSilent,
          newSession.user.email
        )
      })

      return () => {
        mounted = false
        subscription.unsubscribe()
      }
    } else {
      // In Production, NEVER silently load fake authentication
      if (isProduction) {
        clearAllUserTicketCaches()
        clearWorkspaceAndAuthState()
        setSession(null)
        setUser(null)
        setIsLoading(false)
        return
      }

      // Offline / Local Simulation Mode (Development only)
      try {
        const stored = localStorage.getItem(MOCK_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as SimulatedAuthData
          reconcileTicketCacheOwner(parsed.user.id)
          setUser(parsed.user as unknown as User)
          setSession({
            access_token: 'mock_token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'mock_refresh',
            user: parsed.user as unknown as User,
          })
          profileRef.current = parsed.profile
          setProfile(parsed.profile)
          setClubProfile(parsed.clubProfile ?? null)
          setStudentProfile(parsed.studentProfile ?? null)
          void fetchProfile(
            parsed.user.id,
            parsed.user.user_metadata as Record<string, unknown>,
            true,
            parsed.user.email
          )
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
  }, [fetchProfile, clearWorkspaceAndAuthState])

  // ── Refresh Profile & Memberships ─────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (isSupabaseConfigured) {
      try {
        const { data: { user: freshUser } } = await supabase.auth.getUser()
        if (freshUser) {
          setUser(freshUser)
          await fetchProfile(freshUser.id, freshUser.user_metadata, true, freshUser.email)
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
          await fetchProfile(
            parsed.user.id,
            parsed.user.user_metadata as Record<string, unknown>,
            true,
            parsed.user.email
          )
          return
        }
      } catch {
        // ignore
      }
    }

    if (user?.id) {
      await fetchProfile(user.id, user.user_metadata, false, user.email)
    }
  }, [user, fetchProfile])

  const refreshMemberships = useCallback(async () => {
    if (!user?.id) return
    await fetchProfile(user.id, user.user_metadata, true, user.email)
  }, [user, fetchProfile])

  // ── Update Profile & Settings ──────────────────────────────────────────────
  const updateProfile = useCallback(
    async (params: {
      displayName?: string
      collegeName?: string
      collegeId?: string | null
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

            if (pErr) {
              console.warn('[FestFlow Auth] Profiles update failed:', pErr.message)
              return { error: pErr.message || 'Failed to update profile.' }
            }
          }

          // 2. Update student_profiles table if student fields provided
          if (params.collegeName !== undefined || params.collegeId !== undefined || params.gradYear !== undefined) {
            const updatePayload: Record<string, any> = {
              updated_at: new Date().toISOString(),
            }
            if (params.collegeName !== undefined) updatePayload.college_name = params.collegeName?.trim() || null
            if (params.collegeId !== undefined) updatePayload.college_id = params.collegeId || null
            if (params.gradYear !== undefined) updatePayload.graduation_year = params.gradYear

            const { data: updatedRows, error: sErr } = await (supabase.from('student_profiles') as any)
              .update(updatePayload)
              .eq('profile_id', user.id)
              .select('id')

            if (!sErr && (!updatedRows || updatedRows.length === 0)) {
              const { error: insertErr } = await (supabase.from('student_profiles') as any)
                .insert({
                  profile_id: user.id,
                  ...updatePayload,
                })
              if (insertErr) {
                console.warn('[FestFlow Auth] student_profiles insert failed:', insertErr.message)
                return { error: insertErr.message || 'Failed to create student profile.' }
              }
            } else if (sErr) {
              console.warn('[FestFlow Auth] student_profiles update failed:', sErr.message)
              return { error: sErr.message || 'Failed to update student profile.' }
            }
          }

          // 3. Update club_profiles table for the active club if club fields provided
          let clubUpdatePayload: Record<string, any> | null = null
          let targetClubId: string | null = null
          if (
            params.clubName !== undefined ||
            params.repName !== undefined ||
            params.description !== undefined ||
            params.websiteUrl !== undefined ||
            params.collegeId !== undefined
          ) {
            targetClubId =
              activeClubMembership?.club_id ||
              activeClubProfile?.profile_id ||
              legacyOwnedClub?.profile_id ||
              clubProfile?.profile_id ||
              user.id
            clubUpdatePayload = { updated_at: new Date().toISOString() }
            if (params.clubName !== undefined) clubUpdatePayload.club_name = params.clubName.trim()
            if (params.repName !== undefined) clubUpdatePayload.representative_name = params.repName.trim()
            if (params.description !== undefined) clubUpdatePayload.description = params.description?.trim() || null
            if (params.websiteUrl !== undefined) clubUpdatePayload.website_url = params.websiteUrl?.trim() || null
            if (params.collegeId !== undefined) clubUpdatePayload.college_id = params.collegeId || null

            const { error: cErr } = await (supabase.from('club_profiles') as any)
              .update(clubUpdatePayload)
              .eq('profile_id', targetClubId)
            if (cErr) {
              console.warn('[FestFlow Auth] club_profiles update failed:', cErr.message)
              return { error: cErr.message || 'Permission denied: cannot update club profile.' }
            }
          }

          // 4. Update Supabase Auth user_metadata for non-privilege preferences/display fields
          const metadataUpdates: Record<string, any> = {}
          if (params.displayName !== undefined) metadataUpdates.display_name = params.displayName.trim()
          if (params.collegeName !== undefined) metadataUpdates.college = params.collegeName?.trim() || null
          if (params.collegeId !== undefined) metadataUpdates.college_id = params.collegeId || null
          if (params.gradYear !== undefined) metadataUpdates.graduation_year = params.gradYear
          if (params.phone !== undefined) metadataUpdates.phone = params.phone?.trim() || null
          if (params.clubName !== undefined) metadataUpdates.club_name = params.clubName.trim()
          if (params.preferences !== undefined) metadataUpdates.preferences = params.preferences

          if (Object.keys(metadataUpdates).length > 0) {
            const { error: authErr } = await supabase.auth.updateUser({
              data: metadataUpdates,
            })
            if (authErr) {
              console.warn('[FestFlow Auth] Auth user_metadata update note:', authErr.message)
            }
          }

          // 5. Optimistically update local React state for instantaneous UI sync
          setProfile((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              ...(params.displayName !== undefined ? { display_name: params.displayName.trim() } : {}),
            }
          })

          if (clubUpdatePayload && targetClubId) {
            const clubPatch = clubUpdatePayload
            setActiveClubProfile((prev) =>
              prev && prev.profile_id === targetClubId ? { ...prev, ...clubPatch } : prev
            )
            setClubProfile((prev) =>
              prev && prev.profile_id === targetClubId ? { ...prev, ...clubPatch } : prev
            )
            setLegacyOwnedClub((prev) =>
              prev && prev.profile_id === targetClubId ? { ...prev, ...clubPatch } : prev
            )
          }

          setStudentProfile((prev) => {
            if (!prev) {
              return {
                id: `sp_${user.id}`,
                profile_id: user.id,
                college_name: params.collegeName?.trim() || null,
                college_id: params.collegeId || null,
                graduation_year: params.gradYear ?? null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            }
            return {
              ...prev,
              ...(params.collegeName !== undefined ? { college_name: params.collegeName?.trim() || null } : {}),
              ...(params.collegeId !== undefined ? { college_id: params.collegeId || null } : {}),
              ...(params.gradYear !== undefined ? { graduation_year: params.gradYear } : {}),
              updated_at: new Date().toISOString(),
            }
          })

          setUser((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              user_metadata: {
                ...prev.user_metadata,
                ...metadataUpdates,
              },
            }
          })

          // 6. Refresh user session and profiles from DB
          try {
            await refreshProfile()
          } catch (rErr) {
            console.warn('[FestFlow Auth] refreshProfile non-blocking note:', rErr)
          }

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
    [user, refreshProfile, activeClubMembership, activeClubProfile, legacyOwnedClub, clubProfile]
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
            reconcileTicketCacheOwner(data.user.id)
            setUser(data.user)
            setSession(data.session)
            const loadedProfile = await fetchProfile(
              data.user.id,
              data.user.user_metadata,
              false,
              data.user.email
            )
            const role: UserRole = loadedProfile?.role || 'student'
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
          reconcileTicketCacheOwner(mockData.user.id)
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

  // ── Sign In With Google (OAuth 2.0 PKCE) ─────────────────────────────────
  const signInWithGoogle = useCallback(
    async (options?: { redirectTo?: string; role?: UserRole }): Promise<{ error: string | null }> => {
      setIsLoading(true)
      try {
        const nextTarget = options?.redirectTo || ''
        if (nextTarget && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('festflow_oauth_next', nextTarget)
          } catch {
            // ignore storage failure
          }
        }
        if (options?.role && typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('festflow_oauth_role', options.role)
          } catch {
            // ignore storage failure
          }
        }

        if (isSupabaseConfigured) {
          const callbackUrl = nextTarget
            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`
            : `${window.location.origin}/auth/callback`

          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: callbackUrl,
            },
          })

          if (error) {
            setIsLoading(false)
            return { error: error.message }
          }
          return { error: null }
        } else {
          // Block simulated OAuth if in production
          if (isProduction) {
            setIsLoading(false)
            return {
              error: 'Production Configuration Error: Supabase backend is not configured. Live credentials (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) must be provided in deployment environment settings.',
            }
          }

          // Offline / Simulation Mode (Development only)
          await new Promise((r) => setTimeout(r, 600))
          const demoRole: UserRole = 'student' // New Google users default to student
          const demoId = 'google-demo-user-' + Date.now()
          const demoEmail = 'student.google@campus.edu'
          const demoName = 'Google Student'

          const mockData: SimulatedAuthData = {
            user: {
              id: demoId,
              email: demoEmail,
              user_metadata: {
                role: demoRole,
                display_name: demoName,
              },
              email_confirmed_at: new Date().toISOString(),
            },
            profile: {
              id: demoId,
              role: demoRole,
              display_name: demoName,
              email: demoEmail,
              avatar_url: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            clubProfile: null,
            studentProfile: {
              id: `sp_${demoId}`,
              profile_id: demoId,
              college_name: 'National Institute of Technology',
              graduation_year: 2026,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          }

          localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(mockData))
          reconcileTicketCacheOwner(mockData.user.id)
          setUser(mockData.user as unknown as User)
          setSession({
            access_token: 'mock_google_token',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: 'mock_google_refresh',
            user: mockData.user as unknown as User,
          })
          setProfile(mockData.profile)
          setClubProfile(null)
          setStudentProfile(mockData.studentProfile ?? null)
          setIsLoading(false)
          return { error: null }
        }
      } catch (err: any) {
        setIsLoading(false)
        return { error: err instanceof Error ? err.message : 'Google authentication could not be initiated.' }
      }
    },
    []
  )

  // ── Sign Up Club ──────────────────────────────────────────────────────────
  const signUpClub = useCallback(
    async ({
      name,
      clubName,
      email,
      password,
      collegeId,
      collegeName,
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
                college_id: collegeId || null,
                college: collegeName || null,
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
      collegeId,
      collegeName,
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
                college_id: collegeId || null,
                college: collegeName || null,
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
      clearWorkspaceAndAuthState()
    } finally {
      // Unconditionally purge all user-specific cached passes and session credentials on logout
      clearAllUserTicketCaches()
      setIsLoading(false)
    }
  }, [clearWorkspaceAndAuthState])

  // ── Fast Demo Sign-In Helper (Development Only) ─────────────────────────
  const setDemoUser = useCallback(
    (targetRole: 'club_member' | 'student' | 'platform_admin') => {
      if (isProduction) {
        console.error('[FestFlow Security Safeguard] Demo logins are permanently disabled in production builds.')
        return
      }

      clearWorkspaceAndAuthState()

      const isClub = targetRole === 'club_member'
      const isAdmin = targetRole === 'platform_admin'
      const name = isAdmin ? 'Platform Administrator' : isClub ? 'Sarah Chen' : 'Alex Rivera'
      const email = isAdmin ? 'admin@festflow.online' : isClub ? 'organizer@robotics-club.edu' : 'alex.rivera@campus.edu'
      const demoId = `demo_${targetRole}_${Date.now()}`
      const nowIso = new Date().toISOString()

      const demoClubProfile: ClubProfile | null = isClub
        ? {
            id: `cp_${demoId}`,
            profile_id: demoId,
            club_name: 'Robotics & AI Club',
            representative_name: name,
            website_url: 'https://robotics-festflow.edu',
            description: 'Premier student robotics team and hackathon host.',
            is_verified: true,
            created_at: nowIso,
            updated_at: nowIso,
          }
        : null

      const demoData: SimulatedAuthData = {
        user: {
          id: demoId,
          email,
          user_metadata: {
            role: targetRole,
            display_name: name,
            club_name: isClub ? 'Robotics & AI Club' : undefined,
          },
          email_confirmed_at: nowIso,
        },
        profile: {
          id: demoId,
          role: targetRole,
          display_name: name,
          email,
          avatar_url: null,
          created_at: nowIso,
          updated_at: nowIso,
        },
        clubProfile: demoClubProfile,
        studentProfile: !isClub
          ? {
              id: `sp_${demoId}`,
              profile_id: demoId,
              college_name: 'State Tech University',
              graduation_year: 2026,
              created_at: nowIso,
              updated_at: nowIso,
            }
          : null,
      }

      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(demoData))
      reconcileTicketCacheOwner(demoId)
      setUser(demoData.user as unknown as User)
      setSession({
        access_token: 'mock_token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'mock_refresh',
        user: demoData.user as unknown as User,
      })
      profileRef.current = demoData.profile
      setProfile(demoData.profile)
      setClubProfile(demoClubProfile)
      setLegacyOwnedClub(demoClubProfile)
      setActiveClubProfile(demoClubProfile)
      setStudentProfile(demoData.studentProfile ?? null)

      if (demoClubProfile) {
        const demoMembership: ClubMemberRecord = {
          id: `cm_${demoId}`,
          club_id: demoId,
          user_id: demoId,
          role: 'owner',
          status: 'active',
          created_at: nowIso,
          updated_at: nowIso,
          club_name: demoClubProfile.club_name,
          club: demoClubProfile,
        }
        setClubMemberships([demoMembership])
        setActiveClubMembership(demoMembership)
        setPreferredClubId(demoId)
        try {
          sessionStorage.setItem('festflow_preferred_club_id', demoId)
        } catch {
          // ignore
        }
      }
      setIsLoading(false)
    },
    [clearWorkspaceAndAuthState]
  )

  // ── Dual Workspace & Active Club Helpers ─────────────────────────────────
  const [routeWorkspace, setRouteWorkspace] = useState<WorkspaceType | null>(() => {
    if (typeof window !== 'undefined') {
      return getWorkspaceFromPath(window.location.pathname)
    }
    return null
  })

  // Synchronize workspace with React Router navigation (pushState / replaceState / popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncFromPath = () => {
      setRouteWorkspace(getWorkspaceFromPath(window.location.pathname))
    }

    const origPushState = window.history.pushState.bind(window.history)
    const origReplaceState = window.history.replaceState.bind(window.history)

    window.history.pushState = function (...args: Parameters<History['pushState']>) {
      const result = origPushState(...args)
      queueMicrotask(syncFromPath)
      return result
    }

    window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
      const result = origReplaceState(...args)
      queueMicrotask(syncFromPath)
      return result
    }

    window.addEventListener('popstate', syncFromPath)
    window.addEventListener('festflow:navigation', syncFromPath)

    return () => {
      window.history.pushState = origPushState
      window.history.replaceState = origReplaceState
      window.removeEventListener('popstate', syncFromPath)
      window.removeEventListener('festflow:navigation', syncFromPath)
    }
  }, [])

  const effectiveLegacyClub = isSupabaseConfigured ? legacyOwnedClub : clubProfile

  const hasClubMembership = Boolean(
    effectiveLegacyClub !== null ||
      clubMemberships.some((m) => m.status === 'active')
  )

  const availableClubs: AvailableClub[] = useMemo(() => {
    const list: AvailableClub[] = []
    for (const m of clubMemberships) {
      if (m.status === 'active' && !list.some((c) => c.id === m.club_id)) {
        list.push({
          id: m.club_id,
          name: m.club_name || m.club?.club_name || 'Campus Club',
          role: m.role,
          isOwner: m.role === 'owner',
        })
      }
    }
    if (effectiveLegacyClub && !list.some((c) => c.id === effectiveLegacyClub.profile_id)) {
      list.unshift({
        id: effectiveLegacyClub.profile_id,
        name: effectiveLegacyClub.club_name,
        role: 'owner',
        isOwner: true,
      })
    }
    return list
  }, [effectiveLegacyClub, clubMemberships])

  // Prioritize explicitly selected activeClubMembership; fall back to legacy club profile ONLY if owned cleanly
  const activeClubId: string | null = useMemo(() => {
    if (activeClubMembership && activeClubMembership.status === 'active') {
      return activeClubMembership.club_id
    }
    if (activeClubProfile?.profile_id && availableClubs.some((c) => c.id === activeClubProfile.profile_id)) {
      return activeClubProfile.profile_id
    }
    if (effectiveLegacyClub) {
      return effectiveLegacyClub.profile_id
    }
    return availableClubs[0]?.id || null
  }, [activeClubMembership, activeClubProfile, availableClubs, effectiveLegacyClub])

  const activeClubRole: ClubRole | null = useMemo(() => {
    if (!activeClubId) return null
    if (
      activeClubMembership &&
      activeClubMembership.club_id === activeClubId &&
      activeClubMembership.status === 'active'
    ) {
      return activeClubMembership.role
    }
    const matchingMember = clubMemberships.find(
      (m) => m.club_id === activeClubId && m.status === 'active'
    )
    if (matchingMember) {
      return matchingMember.role
    }
    if (effectiveLegacyClub && effectiveLegacyClub.profile_id === activeClubId) {
      return 'owner'
    }
    return null
  }, [activeClubId, activeClubMembership, clubMemberships, effectiveLegacyClub])

  const isSuperAdminUser =
    profile?.role === 'platform_admin' ||
    Boolean(user?.email && PLATFORM_ADMIN_EMAILS.includes(user.email.toLowerCase().trim())) ||
    Boolean(profile?.email && PLATFORM_ADMIN_EMAILS.includes(profile.email.toLowerCase().trim()))

  const effectiveRole: UserRole | null = isSuperAdminUser
    ? 'platform_admin'
    : isSupabaseConfigured
    ? (profile?.role ?? null)
    : (profile?.role ?? (user?.user_metadata?.role as UserRole) ?? null)

  const hasClubPermission = useCallback(
    (permission: ClubPermission): boolean => {
      if (effectiveRole === 'platform_admin') return true
      return hasPermission(activeClubRole, permission)
    },
    [effectiveRole, activeClubRole]
  )

  const hasEventPermission = useCallback(
    (eventId: string, permission: ClubPermission, eventClubId?: string | null): boolean => {
      if (effectiveRole === 'platform_admin') return true
      const targetClubId = eventClubId || activeClubId
      if (!targetClubId || !eventId) return false

      let clubRoleForEvent: ClubRole | null = null
      const memberForClub = clubMemberships.find(
        (m) => m.club_id === targetClubId && m.status === 'active'
      )
      if (memberForClub) {
        clubRoleForEvent = memberForClub.role
      } else if (effectiveLegacyClub && effectiveLegacyClub.profile_id === targetClubId) {
        clubRoleForEvent = 'owner'
      }

      if (!clubRoleForEvent) return false

      return hasEventPermissionHelper({
        clubRole: clubRoleForEvent,
        clubId: targetClubId,
        eventClubId: eventClubId || targetClubId,
        eventId,
        userId: user?.id,
        eventAssignments,
        permission,
      })
    },
    [effectiveRole, activeClubId, clubMemberships, effectiveLegacyClub, eventAssignments, user?.id]
  )

  // Live RBAC Synchronization (Supabase Realtime + BroadcastChannel + Focus/Visibility)
  useEffect(() => {
    if (!user?.id) return

    let refreshTimer: ReturnType<typeof setTimeout> | null = null
    let lastFocusRefreshAt = 0

    const scheduleSilentRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      refreshTimer = setTimeout(() => {
        if (user?.id) {
          void fetchProfile(user.id, user.user_metadata, true, user.email)
        }
      }, 150)
    }

    const unsubscribeSync = subscribeToStatusChanges(
      [
        'role_updated',
        'membership_updated',
        'event_assignment_updated',
        'team_updated',
        'invitation_accepted',
        'reconnect',
      ],
      (evt) => {
        if (
          evt.type === 'reconnect' ||
          !evt.studentId ||
          evt.studentId === user.id ||
          (activeClubId && evt.clubId === activeClubId)
        ) {
          scheduleSilentRefresh()
        }
      }
    )

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastFocusRefreshAt < 10000) return
      lastFocusRefreshAt = now
      scheduleSilentRefresh()
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus)
      document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    }

    let rbacChannel: any = null
    if (isSupabaseConfigured) {
      try {
        const uid = user.id
        const userEmailLower = (user.email || '').toLowerCase().trim()
        rbacChannel = supabase
          .channel(`auth-rbac-${uid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'club_members' },
            (payload) => {
              const row: any = payload.new || payload.old
              if (!row?.user_id || row.user_id === uid) {
                scheduleSilentRefresh()
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'event_assignments' },
            (payload) => {
              const row: any = payload.new || payload.old
              if (!row?.user_id || row.user_id === uid) {
                scheduleSilentRefresh()
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'club_invitations' },
            (payload) => {
              const row: any = payload.new || payload.old
              const rowEmail = String(row?.email || '').toLowerCase().trim()
              if (!rowEmail || (userEmailLower && rowEmail === userEmailLower)) {
                scheduleSilentRefresh()
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
            () => {
              scheduleSilentRefresh()
            }
          )
          .subscribe()
      } catch {
        rbacChannel = null
      }
    }

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer)
      unsubscribeSync()
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus)
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      }
      if (rbacChannel && isSupabaseConfigured) {
        try {
          supabase.removeChannel(rbacChannel)
        } catch {
          // ignore
        }
      }
    }
  }, [user?.id, user?.email, activeClubId, fetchProfile])

  const isDualEligible = useMemo(() => {
    return isDualWorkspaceEligible(
      effectiveRole,
      effectiveLegacyClub,
      clubMemberships
    )
  }, [effectiveRole, effectiveLegacyClub, clubMemberships])

  const activeWorkspace: WorkspaceType = useMemo(() => {
    // Route explicitly dedicated to a workspace takes immediate priority
    if (
      routeWorkspace === 'club' &&
      canAccessClubWorkspace(effectiveRole, effectiveLegacyClub, clubMemberships)
    ) {
      return 'club'
    }
    if (routeWorkspace === 'student' && canAccessStudentWorkspace(effectiveRole)) {
      return 'student'
    }

    // On neutral routes (e.g. /discover, /events/:id, /): respect user preference
    if (
      preferredWorkspace === 'club' &&
      canAccessClubWorkspace(effectiveRole, effectiveLegacyClub, clubMemberships)
    ) {
      return 'club'
    }
    if (canAccessStudentWorkspace(effectiveRole)) {
      return 'student'
    }
    if (canAccessClubWorkspace(effectiveRole, effectiveLegacyClub, clubMemberships)) {
      return 'club'
    }
    return 'student'
  }, [routeWorkspace, preferredWorkspace, effectiveRole, effectiveLegacyClub, clubMemberships])

  const switchWorkspace = useCallback(
    (target: WorkspaceType, navigate?: (path: string) => void) => {
      if (target === 'club') {
        if (!canAccessClubWorkspace(effectiveRole, effectiveLegacyClub, clubMemberships)) {
          console.warn('[FestFlow Security] Access to Club Workspace denied: no active club membership.')
          return
        }
        setPreferredWorkspace('club')
        try {
          sessionStorage.setItem('festflow_active_workspace', 'club')
        } catch {
          // ignore
        }
        if (navigate) {
          navigate('/club/dashboard')
        } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/club/')) {
          window.location.assign('/club/dashboard')
        }
      } else {
        if (!canAccessStudentWorkspace(effectiveRole)) {
          console.warn('[FestFlow Security] Access to Student Workspace denied.')
          return
        }
        setPreferredWorkspace('student')
        try {
          sessionStorage.setItem('festflow_active_workspace', 'student')
        } catch {
          // ignore
        }
        if (navigate) {
          navigate('/student/dashboard')
        } else if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/student/')) {
          window.location.assign('/student/dashboard')
        }
      }
    },
    [effectiveRole, effectiveLegacyClub, clubMemberships]
  )

  const switchActiveClub = useCallback(
    async (clubId: string): Promise<boolean> => {
      const targetClub = availableClubs.find((c) => c.id === clubId)
      if (!targetClub) {
        console.warn('[FestFlow Security] Unauthorized attempt to switch to unknown club ID:', clubId)
        return false
      }

      preferredClubIdRef.current = clubId
      setPreferredClubId(clubId)
      try {
        sessionStorage.setItem('festflow_preferred_club_id', clubId)
      } catch {
        // ignore
      }

      const membership = clubMemberships.find((m) => m.club_id === clubId && m.status === 'active')
      if (membership) {
        setActiveClubMembership(membership)
        if (membership.club) {
          setActiveClubProfile(membership.club)
        } else if (isSupabaseConfigured) {
          try {
            const { data: cOrgData } = await (supabase.from('club_profiles') as any)
              .select('*')
              .eq('profile_id', clubId)
              .maybeSingle()
            if (cOrgData) {
              setActiveClubProfile(cOrgData as unknown as ClubProfile)
            }
          } catch {
            // ignore
          }
        }
        broadcastStatusChange({ type: 'team_updated', clubId })
        return true
      }

      if (effectiveLegacyClub && effectiveLegacyClub.profile_id === clubId) {
        setActiveClubMembership(null)
        setActiveClubProfile(effectiveLegacyClub)
        broadcastStatusChange({ type: 'team_updated', clubId })
        return true
      }

      return false
    },
    [availableClubs, effectiveLegacyClub, clubMemberships]
  )

  const value: AuthContextType = {
    session,
    user,
    profile,
    clubProfile,
    studentProfile,
    clubMemberships,
    activeClubMembership,
    eventAssignments,
    hasClubMembership,
    activeClubId,
    activeClubProfile,
    activeWorkspace,
    isDualEligible,
    availableClubs,
    activeClubRole,
    hasClubPermission,
    hasEventPermission,
    role: effectiveRole,
    isLoading,
    isRoleLoading,
    profileError,
    isConfigured: isSupabaseConfigured,
    switchWorkspace,
    switchActiveClub,
    signIn,
    signInWithGoogle,
    signUpClub,
    signUpStudent,
    signOut,
    resendVerification,
    resetPassword,
    updatePassword,
    refreshProfile,
    refreshMemberships,
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
