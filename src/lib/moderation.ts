import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { UserBlockRecord, CommunityReportRecord, ReportTargetType } from '@/types'

const LOCAL_STORAGE_BLOCKS = 'festflow_local_user_blocks'
const LOCAL_STORAGE_REPORTS = 'festflow_local_community_reports'

let inMemoryBlocks: UserBlockRecord[] | null = null
let inMemoryReports: CommunityReportRecord[] | null = null

function getLocalBlocks(): UserBlockRecord[] {
  if (inMemoryBlocks !== null) return inMemoryBlocks
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_BLOCKS)
      if (raw) {
        inMemoryBlocks = JSON.parse(raw)
        return inMemoryBlocks!
      }
    }
  } catch {
    // ignore
  }
  inMemoryBlocks = []
  return inMemoryBlocks
}

function saveLocalBlocks(blocks: UserBlockRecord[]): void {
  inMemoryBlocks = blocks
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_BLOCKS, JSON.stringify(blocks))
    }
  } catch {
    // ignore
  }
}

function getLocalReports(): CommunityReportRecord[] {
  if (inMemoryReports !== null) return inMemoryReports
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(LOCAL_STORAGE_REPORTS)
      if (raw) {
        inMemoryReports = JSON.parse(raw)
        return inMemoryReports!
      }
    }
  } catch {
    // ignore
  }
  inMemoryReports = []
  return inMemoryReports
}

function saveLocalReports(reports: CommunityReportRecord[]): void {
  inMemoryReports = reports
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_REPORTS, JSON.stringify(reports))
    }
  } catch {
    // ignore
  }
}

/**
 * Blocks a user from sending messages or teammate discovery requests.
 */
export async function blockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; message?: string }> {
  if (!blockerId || !blockedId) return { success: false, message: 'Invalid block request parameters.' }
  if (blockerId === blockedId) return { success: false, message: 'You cannot block yourself.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('user_blocks') as any).insert({
        blocker_id: blockerId,
        blocked_id: blockedId,
      })
      if (error && error.code !== '23505') {
        return { success: false, message: error.message }
      }
      return { success: true, message: 'User blocked successfully.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to block user.' }
    }
  }

  const blocks = getLocalBlocks()
  const exists = blocks.some((b) => b.blocker_id === blockerId && b.blocked_id === blockedId)
  if (!exists) {
    blocks.push({
      id: `blk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      blocker_id: blockerId,
      blocked_id: blockedId,
      created_at: new Date().toISOString(),
    })
    saveLocalBlocks(blocks)
  }
  return { success: true, message: 'User blocked successfully.' }
}

/**
 * Removes an existing block.
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string
): Promise<{ success: boolean; message?: string }> {
  if (!blockerId || !blockedId) return { success: false, message: 'Invalid unblock parameters.' }

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.from('user_blocks') as any)
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId)
      if (error) return { success: false, message: error.message }
      return { success: true, message: 'User unblocked successfully.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to unblock user.' }
    }
  }

  const blocks = getLocalBlocks().filter(
    (b) => !(b.blocker_id === blockerId && b.blocked_id === blockedId)
  )
  saveLocalBlocks(blocks)
  return { success: true, message: 'User unblocked successfully.' }
}

/**
 * Retrieves the set of IDs blocked by a user.
 */
export async function getBlockedUserIds(userId: string): Promise<string[]> {
  if (!userId) return []

  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('user_blocks') as any)
        .select('blocked_id')
        .eq('blocker_id', userId)
      return (data || []).map((row: any) => row.blocked_id)
    } catch {
      return []
    }
  }

  return getLocalBlocks()
    .filter((b) => b.blocker_id === userId)
    .map((b) => b.blocked_id)
}

/**
 * Checks whether user A and user B have an active block between them in either direction.
 */
export async function isUserBlocked(userA: string, userB: string): Promise<boolean> {
  if (!userA || !userB || userA === userB) return false

  if (isSupabaseConfigured) {
    try {
      const { data } = await (supabase.from('user_blocks') as any)
        .select('id')
        .or(
          `and(blocker_id.eq.${userA},blocked_id.eq.${userB}),and(blocker_id.eq.${userB},blocked_id.eq.${userA})`
        )
        .limit(1)
      return !!(data && data.length > 0)
    } catch {
      return false
    }
  }

  return getLocalBlocks().some(
    (b) =>
      (b.blocker_id === userA && b.blocked_id === userB) ||
      (b.blocker_id === userB && b.blocked_id === userA)
  )
}

/**
 * Submits an abuse report for moderation audit.
 */
export async function submitCommunityReport(params: {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  reason: string
  details?: string
}): Promise<{ success: boolean; reportId?: string; message?: string }> {
  if (!params.reporterId || !params.targetType || !params.targetId || !params.reason?.trim()) {
    return { success: false, message: 'Please provide all required report details.' }
  }

  const payload = {
    reporter_id: params.reporterId,
    target_type: params.targetType,
    target_id: params.targetId,
    reason: params.reason.trim(),
    details: params.details?.trim() || null,
    status: 'pending' as const,
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.from('community_reports') as any)
        .insert(payload)
        .select('id')
        .single()
      if (error) return { success: false, message: error.message }
      return { success: true, reportId: data?.id, message: 'Report submitted for community review.' }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to submit report.' }
    }
  }

  const reports = getLocalReports()
  const newId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  reports.unshift({
    ...payload,
    id: newId,
    action_taken: null,
    moderator_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  saveLocalReports(reports)
  return { success: true, reportId: newId, message: 'Report submitted for community review.' }
}
