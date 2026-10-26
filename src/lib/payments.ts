import { supabase, isSupabaseConfigured, isProduction } from '@/lib/supabase'
import type {
  ClubPaymentSettings,
  PaymentSubmission,
  PaymentSubmissionWithDetails,
  PaymentSubmissionResponse,
  PaymentReviewResponse,
  PaymentOrder,
  PaymentOrderWithDetails,
  CreateOrderResponse,
  VerifyOrderResponse,
  InAppNotification,
} from '@/types'
import { getEventById } from '@/lib/events'
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
} from '@/lib/emails'

const LOCAL_STORAGE_PAYMENT_SETTINGS_KEY = 'festflow_local_club_payment_settings'
const LOCAL_STORAGE_PAYMENT_SUBMISSIONS_KEY = 'festflow_local_payment_submissions'
const LOCAL_STORAGE_PAYMENT_ORDERS_KEY = 'festflow_local_payment_orders'
const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'festflow_local_in_app_notifications'

const getEnvVar = (name: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const val = (import.meta as any).env[name]
      if (val) return val
    }
  } catch {
    // ignore
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env) {
      const val = (globalThis as any).process.env[name]
      if (val) return val
    }
  } catch {
    // ignore
  }
  return undefined
}

export const isRazorpayConfigured = Boolean(
  getEnvVar('VITE_RAZORPAY_KEY_ID') &&
  getEnvVar('VITE_RAZORPAY_KEY_ID')?.startsWith('rzp_')
)

export function getRazorpayKeyId(): string {
  return getEnvVar('VITE_RAZORPAY_KEY_ID') || ''
}

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

function getLocalPaymentOrders(): PaymentOrder[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PAYMENT_ORDERS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return []
}

function saveLocalPaymentOrders(orders: PaymentOrder[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PAYMENT_ORDERS_KEY, JSON.stringify(orders))
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

      // Try signed URL with 7 days validity for private storage access
      const { data: signedData } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7)

      if (signedData?.signedUrl) {
        return { success: true, url: signedData.signedUrl }
      }

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

// ── Resolve Payment Proof URL for Organizers (handles private bucket) ──────
export async function getPaymentProofSignedUrl(rawUrlOrPath: string): Promise<string> {
  if (!isSupabaseConfigured || !rawUrlOrPath) return rawUrlOrPath
  if (rawUrlOrPath.startsWith('data:image')) return rawUrlOrPath
  try {
    let path = rawUrlOrPath
    const marker = '/payment-proofs/'
    if (rawUrlOrPath.includes(marker)) {
      path = rawUrlOrPath.substring(rawUrlOrPath.indexOf(marker) + marker.length)
      if (path.includes('?')) path = path.split('?')[0]
    }
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 3600)
    if (!error && data?.signedUrl) {
      return data.signedUrl
    }
  } catch {
    // ignore
  }
  return rawUrlOrPath
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

  // Trigger lifecycle email
  if (decision === 'approved') {
    sendPaymentApprovedEmail({
      to: 'student@campus.edu',
      name: 'FestFlow Student',
      eventTitle: 'Campus Event',
      ticketCode: issuedTicketCode || 'TKT-CONFIRMED',
      venueName: 'Campus Venue',
      registrationId: targetSub.registration_id,
    }).catch(() => {})
  } else {
    sendPaymentRejectedEmail({
      to: 'student@campus.edu',
      name: 'FestFlow Student',
      eventTitle: 'Campus Event',
      reason: notes || 'Transaction reference could not be verified in organizer account.',
      registrationId: targetSub.registration_id,
    }).catch(() => {})
  }

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

// ── Payment Orders & Online Checkout API ────────────────────────────────────

/**
 * Dynamically loads the Razorpay checkout script from the official CDN.
 */
export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if ((window as any).Razorpay) return true

  return new Promise((resolve) => {
    const existing = document.getElementById('razorpay-checkout-script')
    if (existing) {
      resolve(true)
      return
    }

    const script = document.createElement('script')
    script.id = 'razorpay-checkout-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => {
      console.warn('Failed to load Razorpay Checkout SDK from CDN.')
      resolve(false)
    }
    document.body.appendChild(script)
  })
}

/**
 * Creates a unique trusted payment order on the backend for a payable registration.
 * Validates registration state, student ownership, event pricing, and prevents duplicates.
 */
export async function createPaymentOrder(
  registrationId: string,
  provider: string = 'razorpay'
): Promise<CreateOrderResponse> {
  if (!registrationId) {
    return {
      success: false,
      error_code: 'INVALID_REGISTRATION_ID',
      message: 'Registration ID is required.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('create_payment_order', {
        p_registration_id: registrationId,
        p_provider: provider,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as CreateOrderResponse
    } catch (err) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Failed to create payment order.',
      }
    }
  }

  // In production, block order creation without Supabase
  if (isProduction) {
    return {
      success: false,
      error_code: 'UNCONFIGURED_PRODUCTION',
      message: 'Production Security Safeguard: Real payment orders require a connected Supabase backend.',
    }
  }

  // Fallback Simulation Mode (Development only)
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const targetReg = localRegs.find((r: any) => r.id === registrationId)

  if (!targetReg) {
    return {
      success: false,
      error_code: 'REGISTRATION_NOT_FOUND',
      message: 'Registration record was not found.',
    }
  }

  if (targetReg.status === 'confirmed') {
    return {
      success: false,
      error_code: 'ALREADY_CONFIRMED',
      message: 'This registration is already confirmed and paid.',
    }
  }

  if (targetReg.status === 'cancelled') {
    return {
      success: false,
      error_code: 'REGISTRATION_CANCELLED',
      message: 'This registration has been cancelled.',
    }
  }

  if (targetReg.status === 'pending_approval') {
    return {
      success: false,
      error_code: 'APPROVAL_REQUIRED',
      message: 'This application is under host review. Payment is locked until approved.',
    }
  }

  const eventRes = await getEventById(targetReg.event_id)
  const event = eventRes.event
  if (!event) {
    return {
      success: false,
      error_code: 'EVENT_NOT_FOUND',
      message: 'Associated event was not found.',
    }
  }

  if (event.is_free || !event.price || event.price <= 0) {
    return {
      success: false,
      error_code: 'FREE_EVENT',
      message: 'This event is free. No payment order is required.',
    }
  }

  const orders = getLocalPaymentOrders()
  // Check if an uncompleted order already exists for this registration with matching amount
  const existing = orders.find(
    (o) => o.registration_id === registrationId && (o.status === 'created' || o.status === 'attempted')
  )

  if (existing) {
    return {
      success: true,
      message: 'Existing active order retrieved.',
      order: {
        id: existing.id,
        order_reference: existing.order_reference,
        registration_id: existing.registration_id,
        event_id: existing.event_id,
        event_title: event.title,
        amount: existing.amount,
        currency: existing.currency,
        provider: existing.provider,
        provider_order_id: existing.provider_order_id,
        status: existing.status,
        created_at: existing.created_at,
      },
    }
  }

  const newOrder: PaymentOrder = {
    id: `ord_${Date.now()}`,
    order_reference: `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    registration_id: registrationId,
    student_id: targetReg.student_id || 'demo_student_default',
    event_id: event.id,
    amount: event.price,
    currency: event.currency || 'INR',
    provider,
    provider_order_id: `order_sim_${Date.now().toString(36)}`,
    provider_payment_id: null,
    provider_signature: null,
    status: 'created',
    idempotency_key: `idem_${Date.now()}_${registrationId}`,
    receipt: `RCP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    metadata: {
      event_title: event.title,
      ticket_code: targetReg.ticket_code,
      created_via: 'web_checkout',
    },
    error_code: null,
    error_description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    paid_at: null,
  }

  orders.unshift(newOrder)
  saveLocalPaymentOrders(orders)

  return {
    success: true,
    message: 'Payment order created successfully.',
    order: {
      id: newOrder.id,
      order_reference: newOrder.order_reference,
      registration_id: newOrder.registration_id,
      event_id: newOrder.event_id,
      event_title: event.title,
      amount: newOrder.amount,
      currency: newOrder.currency,
      provider: newOrder.provider,
      provider_order_id: newOrder.provider_order_id,
      status: 'created',
      created_at: newOrder.created_at,
    },
  }
}

/**
 * Verifies payment order completion through the provider callback / signature,
 * atomically confirms the registration pass, and issues the official ticket code.
 */
export async function verifyPaymentOrder(params: {
  orderId: string
  providerPaymentId: string
  providerSignature: string
  providerOrderId?: string
}): Promise<VerifyOrderResponse> {
  const { orderId, providerPaymentId, providerSignature, providerOrderId } = params

  if (!providerPaymentId || !providerPaymentId.trim()) {
    return {
      success: false,
      error_code: 'INVALID_PAYMENT_ID',
      message: 'Payment transaction reference is required for verification.',
    }
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await (supabase.rpc as any)('verify_payment_order', {
        p_order_id: orderId,
        p_provider_payment_id: providerPaymentId.trim(),
        p_provider_signature: providerSignature.trim(),
        p_provider_order_id: providerOrderId?.trim() || null,
      })

      if (error) {
        return {
          success: false,
          error_code: 'RPC_ERROR',
          message: error.message,
        }
      }

      return data as VerifyOrderResponse
    } catch (err) {
      return {
        success: false,
        error_code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Payment verification failed.',
      }
    }
  }

  // In production, block verification without Supabase
  if (isProduction) {
    return {
      success: false,
      error_code: 'UNCONFIGURED_PRODUCTION',
      message: 'Production Security Safeguard: Real payment verification requires Supabase backend.',
    }
  }

  // Simulation Fallback
  const orders = getLocalPaymentOrders()
  const order = orders.find((o) => o.id === orderId)

  if (!order) {
    return {
      success: false,
      error_code: 'ORDER_NOT_FOUND',
      message: 'Payment order was not found.',
    }
  }

  // Idempotency: if already paid, return confirmed
  if (order.status === 'paid') {
    const rawRegs = localStorage.getItem('festflow_local_registrations')
    const localRegs = rawRegs ? JSON.parse(rawRegs) : []
    const reg = localRegs.find((r: any) => r.id === order.registration_id)

    return {
      success: true,
      message: 'Payment already verified and pass confirmed.',
      order_id: order.id,
      ticket_code: reg?.ticket_code || 'TKT-MOCK',
      status: 'paid',
    }
  }

  order.status = 'paid'
  order.provider_payment_id = providerPaymentId
  order.provider_signature = providerSignature
  order.provider_order_id = providerOrderId || order.provider_order_id
  order.paid_at = new Date().toISOString()
  order.updated_at = new Date().toISOString()
  saveLocalPaymentOrders(orders)

  // Update registration
  const rawRegs = localStorage.getItem('festflow_local_registrations')
  const localRegs = rawRegs ? JSON.parse(rawRegs) : []
  const targetReg = localRegs.find((r: any) => r.id === order.registration_id)

  let issuedCode = targetReg?.ticket_code
  if (targetReg) {
    targetReg.status = 'confirmed'
    if (!issuedCode) {
      issuedCode = `FF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
      targetReg.ticket_code = issuedCode
    }
    targetReg.ticket_issued_at = new Date().toISOString()
    targetReg.updated_at = new Date().toISOString()
    localStorage.setItem('festflow_local_registrations', JSON.stringify(localRegs))
  }

  // Add in-app notification
  const notifs = getLocalNotifications()
  notifs.unshift({
    id: `notif_${Date.now()}`,
    user_id: order.student_id,
    title: 'Payment Confirmed! 🎉',
    message: `Your payment of ${order.currency} ${order.amount} has been verified. Your digital entry pass is now ready!`,
    type: 'payment_confirmed',
    link: `/student/tickets/${order.registration_id}`,
    is_read: false,
    created_at: new Date().toISOString(),
  })
  saveLocalNotifications(notifs)

  // Trigger pass confirmation email upon successful payment verification
  sendPaymentApprovedEmail({
    to: 'student@campus.edu',
    name: 'FestFlow Student',
    eventTitle: 'Campus Event',
    ticketCode: issuedCode || 'TKT-ONLINE-CONFIRMED',
    venueName: 'Campus Venue',
    registrationId: order.registration_id,
    orderId: order.id,
  }).catch(() => {})

  return {
    success: true,
    message: 'Payment verified and entry pass confirmed successfully.',
    order_id: order.id,
    ticket_code: issuedCode,
    status: 'paid',
  }
}

/**
 * Records a payment failure or gateway decline on an order while keeping
 * the registration payable so the student can retry.
 */
export async function recordPaymentFailure(params: {
  orderId: string
  errorCode: string
  errorDescription: string
}): Promise<{ success: boolean; message: string }> {
  const { orderId, errorCode, errorDescription } = params

  if (isSupabaseConfigured) {
    try {
      const { error } = await (supabase.rpc as any)('record_payment_failure', {
        p_order_id: orderId,
        p_error_code: errorCode,
        p_error_description: errorDescription,
      })
      if (error) return { success: false, message: error.message }
      return { success: true, message: 'Payment failure recorded.' }
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Failed to record failure.' }
    }
  }

  const orders = getLocalPaymentOrders()
  const order = orders.find((o) => o.id === orderId)
  if (order && order.status !== 'paid') {
    order.status = 'failed'
    order.error_code = errorCode
    order.error_description = errorDescription
    order.updated_at = new Date().toISOString()
    saveLocalPaymentOrders(orders)
  }
  return { success: true, message: 'Payment failure recorded.' }
}

/**
 * Retrieves the most recent payment order for a registration.
 */
export async function getStudentPaymentOrder(
  registrationId: string
): Promise<PaymentOrder | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('registration_id', registrationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error || !data) return null
      return data as PaymentOrder
    } catch {
      return null
    }
  }

  const orders = getLocalPaymentOrders()
  const found = orders.find((o) => o.registration_id === registrationId)
  return found || null
}

/**
 * Retrieves payment orders for a club or event for organizer auditing.
 */
export async function getClubPaymentOrders(
  clubId?: string,
  eventId?: string
): Promise<{ orders: PaymentOrderWithDetails[]; error?: string }> {
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('payment_orders')
        .select(`
          *,
          student:profiles!payment_orders_student_id_fkey(display_name, email, avatar_url),
          event:events!payment_orders_event_id_fkey(*),
          registration:registrations!payment_orders_registration_id_fkey(*)
        `)
        .order('created_at', { ascending: false })

      if (eventId) {
        query = query.eq('event_id', eventId)
      } else if (clubId) {
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
      if (error) return { orders: [], error: error.message }
      return { orders: (data || []) as unknown as PaymentOrderWithDetails[] }
    } catch (err) {
      return { orders: [], error: err instanceof Error ? err.message : 'Failed to query orders.' }
    }
  }

  const orders = getLocalPaymentOrders()
  let filtered = orders
  if (eventId) {
    filtered = filtered.filter((o) => o.event_id === eventId)
  }

  const enriched: PaymentOrderWithDetails[] = await Promise.all(
    filtered.map(async (o) => {
      const eventRes = await getEventById(o.event_id)
      return {
        ...o,
        student: {
          display_name: 'Campus Student',
          email: 'student@campus.edu',
          avatar_url: null,
        },
        event: eventRes.event || undefined,
      }
    })
  )

  return { orders: enriched }
}

