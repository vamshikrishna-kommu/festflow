import { supabase, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import type {
  ClubPaymentSettings,
  PaymentSubmission,
  PaymentSubmissionWithDetails,
  PaymentSubmissionResponse,
  PaymentReviewResponse,
  InAppNotification,
} from '@/types'
import { getEventById } from '@/lib/events'

const LOCAL_STORAGE_PAYMENT_SETTINGS_KEY = 'festflow_local_club_payment_settings'
const LOCAL_STORAGE_PAYMENT_SUBMISSIONS_KEY = 'festflow_local_payment_submissions'
const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'festflow_local_in_app_notifications'

// ── UPI ID Validator ────────────────────────────────────────────────────────
export function validateUpiId(upiId: string): boolean {
  if (!upiId) return false
  const trimmed = upiId.trim()
  // Matches typical UPI handles: user@bank, e.g. clubname@okaxis, fest@icici, etc.
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/
  return upiRegex.test(trimmed)
}

// ── Local Storage Seed Helpers ──────────────────────────────────────────────
function getLocalPaymentSettings(): Record<string, ClubPaymentSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PAYMENT_SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {
    demo_club_member_default: {
      id: 'settings_demo_default',
      club_id: 'demo_club_member_default',
      upi_id: 'festflow.council@okaxis',
      account_name: 'Campus Student Council & Events',
      payment_instructions:
        'Please add your registration code or name in the UPI payment note/remark. Keep your 12-digit UTR handy for submission.',
      qr_image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

function saveLocalPaymentSettings(settings: Record<string, ClubPaymentSettings>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PAYMENT_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}

function getLocalPaymentSubmissions(): PaymentSubmission[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PAYMENT_SUBMISSIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return [
    {
      id: 'sub_sample_1',
      registration_id: 'reg_sample_2',
      student_id: 'demo_student_default',
      event_id: 'evt_sample_2',
      amount: 499,
      currency: 'INR',
      transaction_reference: 'UTR987654321098',
      screenshot_url: null,
      status: 'pending_review',
      reviewer_id: null,
      review_notes: 'Payment transferred via Google Pay. Awaiting organizer approval.',
      submitted_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      reviewed_at: null,
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ]
}

function saveLocalPaymentSubmissions(subs: PaymentSubmission[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PAYMENT_SUBMISSIONS_KEY, JSON.stringify(subs))
  } catch {
    // ignore
  }
}

function getLocalNotifications(): InAppNotification[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_NOTIFICATIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return [
    {
      id: 'notif_sample_1',
      user_id: 'demo_club_member_default',
      title: 'New Payment Submitted',
      message: 'Payment of INR 499 submitted for Hackathon 2026 (Ref: UTR987654321098).',
      type: 'payment_submitted',
      link: '/club/payments',
      is_read: false,
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
  ]
}

function saveLocalNotifications(notifs: InAppNotification[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_NOTIFICATIONS_KEY, JSON.stringify(notifs))
  } catch {
    // ignore
  }
}

// ── Club Payment Settings API ───────────────────────────────────────────────
export async function getClubPaymentSettings(clubId: string): Promise<ClubPaymentSettings | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('club_payment_settings')
        .select('*')
        .eq('club_id', clubId)
        .maybeSingle()

      if (error) {
        console.warn('Error fetching club payment settings:', error.message)
        return null
      }
      return data as ClubPaymentSettings | null
    } catch (err) {
      console.warn('Fetch club payment settings exception:', err)
      return null
    }
  }

  const map = getLocalPaymentSettings()
  return map[clubId] || map['demo_club_member_default'] || null
}

export async function saveClubPaymentSettings(params: {
  clubId: string
  upi_id: string
  account_name: string
  payment_instructions?: string
  qr_image_url?: string | null
}): Promise<{ success: boolean; settings?: ClubPaymentSettings; message: string }> {
  const { clubId, upi_id, account_name, payment_instructions, qr_image_url } = params

  if (!validateUpiId(upi_id)) {
    return {
      success: false,
      message: 'Invalid UPI ID format. Standard format is username@bank (e.g. festival@okaxis).',
    }
  }

  if (!account_name.trim()) {
    return {
      success: false,
      message: 'Account / display name is required.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const payload = {
        club_id: clubId,
        upi_id: upi_id.trim(),
        account_name: account_name.trim(),
        payment_instructions: payment_instructions?.trim() || null,
        qr_image_url: qr_image_url || null,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await (supabase.from('club_payment_settings') as any)
        .upsert(payload, { onConflict: 'club_id' })
        .select()
        .single()

      if (error) {
        return { success: false, message: error.message }
      }

      return {
        success: true,
        settings: data as ClubPaymentSettings,
        message: 'UPI payment settings updated successfully.',
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to update payment settings.',
      }
    }
  }

  // Fallback simulation
  const map = getLocalPaymentSettings()
  const existing = map[clubId] || {
    id: `settings_${Date.now()}`,
    club_id: clubId,
    created_at: new Date().toISOString(),
  }

  const updated: ClubPaymentSettings = {
    ...existing,
    upi_id: upi_id.trim(),
    account_name: account_name.trim(),
    payment_instructions: payment_instructions?.trim() || null,
    qr_image_url: qr_image_url || null,
    updated_at: new Date().toISOString(),
  }

  map[clubId] = updated
  saveLocalPaymentSettings(map)

  return {
    success: true,
    settings: updated,
    message: 'UPI payment settings updated successfully.',
  }
}

// ── Storage Uploads ──────────────────────────────────────────────────────────
export async function uploadClubPaymentQr(
  clubId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const filePath = `${clubId}/upi-qr-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('club-payment-qrs')
        .upload(filePath, file, { upsert: true })

      if (uploadError) return { success: false, error: uploadError.message }

      const { data } = supabase.storage.from('club-payment-qrs').getPublicUrl(filePath)
      return { success: true, url: data.publicUrl }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'QR upload failed.',
      }
    }
  }

  // Fallback: Read as Data URL
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ success: true, url: reader.result as string })
    reader.onerror = () => resolve({ success: false, error: 'Could not read image file.' })
    reader.readAsDataURL(file)
  })
}

export async function uploadPaymentScreenshot(
  studentId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      const fileExt = file.name.split('.').pop() || 'png'
      const filePath = `${studentId}/payment-proof-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file, { upsert: true })

      if (uploadError) return { success: false, error: uploadError.message }

      const { data } = supabase.storage.from('payment-proofs').getPublicUrl(filePath)
      return { success: true, url: data.publicUrl }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Screenshot upload failed.',
      }
    }
  }

  // Fallback: Read as Data URL
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve({ success: true, url: reader.result as string })
    reader.onerror = () => resolve({ success: false, error: 'Could not read image file.' })
    reader.readAsDataURL(file)
  })
}

// ── Student Payment Submission ──────────────────────────────────────────────
export async function submitPaymentProof(params: {
  registrationId: string
  transactionReference: string
  screenshotUrl?: string | null
  notes?: string | null
}): Promise<PaymentSubmissionResponse> {
  const { registrationId, transactionReference, screenshotUrl, notes } = params
  const cleanRef = transactionReference.trim()

  if (!cleanRef || cleanRef.length < 4) {
    return {
      success: false,
      error_code: 'INVALID_REFERENCE',
      message: 'Please provide a valid transaction reference or UTR number (at least 4 characters).',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('submit_payment_submission', {
        p_registration_id: registrationId,
        p_transaction_reference: cleanRef,
        p_screenshot_url: screenshotUrl || null,
        p_notes: notes || null,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as PaymentSubmissionResponse
    } catch (err) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to submit payment details.',
      }
    }
  }

  // In production, block submission if Supabase is unconfigured
  if (isProduction) {
    return {
      success: false,
      error_code: 'UNCONFIGURED_PRODUCTION',
      message: 'Production Security Safeguard: Real payment submissions require a connected Supabase backend.',
    }
  }

  // Local Simulation Mode (Development only)
  const subs = getLocalPaymentSubmissions()

  // Prevent duplicate active/approved submission with identical ref
  const duplicate = subs.find(
    (s) =>
      s.transaction_reference.toLowerCase() === cleanRef.toLowerCase() &&
      (s.status === 'pending_review' || s.status === 'approved')
  )
  if (duplicate) {
    return {
      success: false,
      error_code: 'DUPLICATE_REFERENCE',
      message: 'This transaction reference / UTR has already been submitted for an active payment.',
    }
  }

  // Read existing registration to attach proper event_id and student_id
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const targetReg = localRegs.find((r: any) => r.id === registrationId)

  const studentId = targetReg?.student_id || 'demo_student_default'
  const eventId = targetReg?.event_id || 'evt_sample_2'

  // Retrieve event to get expected price
  const eventRes = await getEventById(eventId)
  const amount = eventRes.event?.price || 499
  const currency = eventRes.event?.currency || 'INR'

  const newSub: PaymentSubmission = {
    id: `sub_${Date.now()}`,
    registration_id: registrationId,
    student_id: studentId,
    event_id: eventId,
    amount,
    currency,
    transaction_reference: cleanRef,
    screenshot_url: screenshotUrl || null,
    status: 'pending_review',
    reviewer_id: null,
    review_notes: notes || null,
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  subs.unshift(newSub)
  saveLocalPaymentSubmissions(subs)

  // Update local registration status to pending_payment if previously rejected
  if (targetReg) {
    targetReg.status = 'pending_payment'
    localStorage.setItem('festflow_local_registrations', JSON.stringify(localRegs))
  }

  // Create notification for club organizer
  const notifs = getLocalNotifications()
  notifs.unshift({
    id: `notif_${Date.now()}`,
    user_id: eventRes.event?.club_id || 'demo_club_member_default',
    title: 'New Payment Submitted',
    message: `Payment of ${currency} ${amount} submitted for ${eventRes.event?.title || 'event'} (Ref: ${cleanRef}).`,
    type: 'payment_submitted',
    link: '/club/payments',
    is_read: false,
    created_at: new Date().toISOString(),
  })
  saveLocalNotifications(notifs)

  return {
    success: true,
    message: 'Payment details submitted for organizer review.',
    submission_id: newSub.id,
    status: 'pending_review',
  }
}

// ── Review Payment Submission ───────────────────────────────────────────────
export async function reviewPaymentSubmission(params: {
  paymentId: string
  decision: 'approved' | 'rejected'
  notes?: string
}): Promise<PaymentReviewResponse> {
  const { paymentId, decision, notes } = params

  if (decision === 'rejected' && (!notes || !notes.trim())) {
    return {
      success: false,
      error_code: 'REASON_REQUIRED',
      message: 'A clear reason for rejection is required to inform the student.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('review_payment_submission', {
        p_payment_id: paymentId,
        p_decision: decision,
        p_notes: notes || null,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as PaymentReviewResponse
    } catch (err) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Review action failed.',
      }
    }
  }

  // In production, forbid simulation payment approval/rejection
  if (isProduction) {
    return {
      success: false,
      error_code: 'UNCONFIGURED_PRODUCTION',
      message: 'Production Security Safeguard: Cannot authorize payment approvals or rejections in simulation mode. Supabase connection required.',
    }
  }

  // Local Simulation Mode (Development only)
  const subs = getLocalPaymentSubmissions()
  const targetSub = subs.find((s) => s.id === paymentId)

  if (!targetSub) {
    return {
      success: false,
      error_code: 'NOT_FOUND',
      message: 'Payment submission not found.',
    }
  }

  if (targetSub.status !== 'pending_review') {
    return {
      success: false,
      error_code: 'ALREADY_REVIEWED',
      message: `This payment has already been ${targetSub.status}.`,
    }
  }

  targetSub.status = decision
  targetSub.reviewed_at = new Date().toISOString()
  targetSub.review_notes = notes || (decision === 'approved' ? 'Payment verified and approved.' : '')
  targetSub.updated_at = new Date().toISOString()
  saveLocalPaymentSubmissions(subs)

  // Update registration
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const targetReg = localRegs.find((r: any) => r.id === targetSub.registration_id)

  let issuedTicketCode = targetReg?.ticket_code
  if (targetReg) {
    if (decision === 'approved') {
      targetReg.status = 'confirmed'
      if (!issuedTicketCode) {
        issuedTicketCode = `TKT-${Math.random().toString(36).substring(2, 10).toUpperCase()}-VERIFIED`
        targetReg.ticket_code = issuedTicketCode
      }
      targetReg.ticket_issued_at = new Date().toISOString()
    } else {
      targetReg.status = 'rejected'
    }
    targetReg.updated_at = new Date().toISOString()
    localStorage.setItem('festflow_local_registrations', JSON.stringify(localRegs))
  }

  // Create notification for student
  const notifs = getLocalNotifications()
  notifs.unshift({
    id: `notif_${Date.now()}`,
    user_id: targetSub.student_id,
    title: decision === 'approved' ? 'Payment Approved! 🎉' : 'Payment Verification Issue',
    message:
      decision === 'approved'
        ? `Your payment of ${targetSub.currency} ${targetSub.amount} was approved. Your digital entry pass is ready!`
        : `Your payment was not approved. Reason: ${notes}`,
    type: decision === 'approved' ? 'payment_approved' : 'payment_rejected',
    link:
      decision === 'approved'
        ? `/student/tickets/${targetSub.registration_id}`
        : `/student/payments/${targetSub.registration_id}`,
    is_read: false,
    created_at: new Date().toISOString(),
  })
  saveLocalNotifications(notifs)

  return {
    success: true,
    message: decision === 'approved' ? 'Payment approved and ticket confirmed.' : 'Payment rejected with notes.',
    status: decision,
    ticket_code: issuedTicketCode,
  }
}

// ── Query Payment Submissions ───────────────────────────────────────────────
export async function getClubPaymentSubmissions(
  clubId?: string,
  eventId?: string
): Promise<{ submissions: PaymentSubmissionWithDetails[]; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('payment_submissions')
        .select(`
          *,
          student:profiles!payment_submissions_student_id_fkey(display_name, email, avatar_url),
          event:events!payment_submissions_event_id_fkey(*),
          registration:registrations!payment_submissions_registration_id_fkey(*)
        `)
        .order('submitted_at', { ascending: false })

      if (eventId) {
        query = query.eq('event_id', eventId)
      } else if (clubId) {
        // Events owned by club
        const { data: clubEvents } = await supabase
          .from('events')
          .select('id')
          .eq('club_id', clubId)

        const eventsList = (clubEvents || []) as Array<{ id: string }>
        if (eventsList.length > 0) {
          const eventIds = eventsList.map((e) => e.id)
          query = query.in('event_id', eventIds)
        }
      }

      const { data, error } = await query

      if (error) {
        return { submissions: [], error: error.message }
      }

      return { submissions: (data || []) as unknown as PaymentSubmissionWithDetails[] }
    } catch (err) {
      return {
        submissions: [],
        error: err instanceof Error ? err.message : 'Failed to query submissions.',
      }
    }
  }

  // Fallback Simulation
  const subs = getLocalPaymentSubmissions()
  let filtered = subs
  if (eventId) {
    filtered = filtered.filter((s) => s.event_id === eventId)
  }

  const enriched: PaymentSubmissionWithDetails[] = await Promise.all(
    filtered.map(async (s) => {
      const eventRes = await getEventById(s.event_id)
      return {
        ...s,
        student: {
          display_name: 'Priya Sharma',
          email: 'priya.sharma@campus.edu',
          avatar_url: null,
        },
        event: eventRes.event || undefined,
      }
    })
  )

  return { submissions: enriched }
}

export async function getStudentPaymentSubmission(
  registrationId: string
): Promise<PaymentSubmission | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('payment_submissions')
        .select('*')
        .eq('registration_id', registrationId)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return null
      return data as PaymentSubmission | null
    } catch {
      return null
    }
  }

  const subs = getLocalPaymentSubmissions()
  const found = subs.find((s) => s.registration_id === registrationId)
  return found || null
}

// ── In-App Notifications API ────────────────────────────────────────────────
export async function getInAppNotifications(userId?: string): Promise<InAppNotification[]> {
  if (isSupabaseConfigured && userId) {
    try {
      const { data, error } = await supabase
        .from('in_app_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) return []
      return (data || []) as InAppNotification[]
    } catch {
      return []
    }
  }

  const notifs = getLocalNotifications()
  if (userId) {
    return notifs.filter((n) => n.user_id === userId || n.user_id === 'demo_club_member_default' || n.user_id === 'demo_student_default')
  }
  return notifs
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      await (supabase.from('in_app_notifications') as any)
        .update({ is_read: true })
        .eq('id', notificationId)
    } catch {
      // ignore
    }
    return
  }

  const notifs = getLocalNotifications()
  const target = notifs.find((n) => n.id === notificationId)
  if (target) {
    target.is_read = true
    saveLocalNotifications(notifs)
  }
}

export async function markAllNotificationsRead(userId?: string): Promise<void> {
  if (isSupabaseConfigured && userId) {
    try {
      await (supabase.from('in_app_notifications') as any)
        .update({ is_read: true })
        .eq('user_id', userId)
    } catch {
      // ignore
    }
    return
  }

  const notifs = getLocalNotifications()
  notifs.forEach((n) => {
    n.is_read = true
  })
  saveLocalNotifications(notifs)
}
