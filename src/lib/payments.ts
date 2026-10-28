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
import {
  sendPaymentApprovedEmail,
  sendPaymentRejectedEmail,
  sendPaymentReceivedEmail,
  sendTicketIssuedEmail,
} from '@/lib/emails'
import { broadcastStatusChange } from '@/lib/sync'

const LOCAL_STORAGE_PAYMENT_SETTINGS_KEY = 'festflow_local_club_payment_settings'
const LOCAL_STORAGE_PAYMENT_SUBMISSIONS_KEY = 'festflow_local_payment_submissions'
const LOCAL_STORAGE_NOTIFICATIONS_KEY = 'festflow_local_in_app_notifications'

// ── UPI ID Validator ────────────────────────────────────────────────────────
export function validateUpiId(upiId: string): boolean {
  if (!upiId) return false
  const trimmed = upiId.trim()
  // Matches standard UPI handles: username@bank, e.g. clubname@okaxis, fest@icici, etc.
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9]{2,32}$/
  return upiRegex.test(trimmed)
}

function getLocalPaymentSettings(): Record<string, ClubPaymentSettings> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PAYMENT_SETTINGS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {}
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
  return []
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
  return []
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
      console.warn('Network error fetching payment settings:', err)
      return null
    }
  }

  // Fallback Simulation Mode
  const store = getLocalPaymentSettings()
  return store[clubId] || null
}

export async function saveClubPaymentSettings(settings: {
  clubId: string
  upi_id: string
  account_name: string
  payment_instructions?: string | null
  qr_image_url?: string | null
}): Promise<{ success: boolean; message: string; settings?: ClubPaymentSettings }> {
  const { clubId, upi_id, account_name, payment_instructions, qr_image_url } = settings

  if (!validateUpiId(upi_id)) {
    return {
      success: false,
      message: 'Invalid UPI ID format. Standard format is username@bank (e.g. clubname@okaxis).',
    }
  }

  if (!account_name || !account_name.trim()) {
    return {
      success: false,
      message: 'Account or payee display name is required.',
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
        message: 'UPI payment settings saved successfully!',
        settings: data as ClubPaymentSettings,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Failed to save settings.',
      }
    }
  }

  // Fallback Simulation Mode
  const store = getLocalPaymentSettings()
  const updated: ClubPaymentSettings = {
    id: store[clubId]?.id || `settings_${Date.now()}`,
    club_id: clubId,
    upi_id: upi_id.trim(),
    account_name: account_name.trim(),
    payment_instructions: payment_instructions?.trim() || null,
    qr_image_url: qr_image_url || null,
    created_at: store[clubId]?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  store[clubId] = updated
  saveLocalPaymentSettings(store)

  return {
    success: true,
    message: 'UPI payment settings saved successfully (Local Mode)!',
    settings: updated,
  }
}

export async function uploadClubPaymentQr(
  clubId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ success: true, url: reader.result as string })
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file locally.' })
      reader.readAsDataURL(file)
    })
  }

  try {
    const fileExt = file.name.split('.').pop()
    const filePath = `${clubId}/upi-qr-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('club-payment-qrs')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data: publicUrlData } = supabase.storage
      .from('club-payment-qrs')
      .getPublicUrl(filePath)

    return { success: true, url: publicUrlData.publicUrl }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error uploading QR image.',
    }
  }
}

export async function uploadPaymentScreenshot(
  studentId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ success: true, url: reader.result as string })
      reader.onerror = () => resolve({ success: false, error: 'Failed to read file locally.' })
      reader.readAsDataURL(file)
    })
  }

  try {
    const fileExt = file.name.split('.').pop()
    const filePath = `${studentId}/proof-${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('payment-proofs')
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    return { success: true, url: filePath }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload screenshot.',
    }
  }
}

export async function getPaymentProofSignedUrl(filePath: string): Promise<string | null> {
  if (!filePath) return null
  if (filePath.startsWith('data:') || filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath
  }

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(filePath, 3600)

      if (error) return null
      return data.signedUrl
    } catch {
      return null
    }
  }

  return filePath
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

      const res = data as PaymentSubmissionResponse
      if (res.success) {
        // Dispatch payment_received transactional email
        try {
          const { data: regData } = await (supabase.from('registrations') as any)
            .select(`
              id,
              event_id,
              student_id,
              participant_details,
              events (id, title, club_id, price),
              profiles:student_id (email, display_name)
            `)
            .eq('id', registrationId)
            .single()

          if (regData) {
            const recipientEmail =
              regData.participant_details?.email ||
              regData.profiles?.email ||
              ''
            const recipientName =
              regData.participant_details?.student_name ||
              regData.profiles?.display_name ||
              'FestFlow Student'
            const eventTitle = regData.events?.title || 'Campus Event'
            const paidAmount = Number((regData.events as any)?.price) || 0

            if (recipientEmail) {
              sendPaymentReceivedEmail({
                to: recipientEmail,
                name: recipientName,
                eventTitle,
                transactionReference: cleanRef,
                amount: paidAmount,
                registrationId,
                eventId: regData.event_id,
              }).catch(() => {})
            }
          }
        } catch {
          // non-blocking
        }
      }

      return res
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

  const studentId = targetReg?.student_id || ''
  const eventId = targetReg?.event_id || ''

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
    user_id: eventRes.event?.club_id || '',
    title: 'New UPI Payment Submitted',
    message: `Payment of ${currency} ${amount} submitted for ${eventRes.event?.title || 'event'} (Ref: ${cleanRef}).`,
    type: 'payment_submitted',
    link: '/club/payments',
    is_read: false,
    created_at: new Date().toISOString(),
  })
  saveLocalNotifications(notifs)

  // Send payment submission email with dynamic recipient
  const recipientEmail = targetReg?.participant_details?.email || 'student@campus.edu'
  const recipientName = targetReg?.participant_details?.student_name || 'FestFlow Student'

  sendPaymentReceivedEmail({
    to: recipientEmail,
    name: recipientName,
    eventTitle: eventRes.event?.title || 'Campus Event',
    transactionReference: cleanRef,
    amount,
    registrationId,
    eventId,
  }).catch(() => {})

  // Broadcast realtime status change
  broadcastStatusChange({
    type: 'payment_submitted',
    registrationId,
    eventId,
    studentId,
    clubId: eventRes.event?.club_id,
    payload: { transactionReference: cleanRef, amount },
  })

  return {
    success: true,
    message: 'Payment reference submitted successfully for organizer verification.',
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

      const res = data as PaymentReviewResponse
      if (res.success) {
        // Dispatch payment_approved / payment_rejected transactional emails
        try {
          const { data: payData } = await (supabase.from('payment_submissions') as any)
            .select(`
              id,
              registration_id,
              event_id,
              student_id,
              registrations (
                id,
                ticket_code,
                qr_token,
                participant_details,
                team_name,
                team_id,
                events (id, title, venue_name),
                profiles:student_id (email, display_name)
              )
            `)
            .eq('id', paymentId)
            .single()

          if (payData && payData.registrations) {
            const reg = payData.registrations
            const recipientEmail =
              reg.participant_details?.email ||
              reg.profiles?.email ||
              ''
            const recipientName =
              reg.participant_details?.student_name ||
              reg.profiles?.display_name ||
              'FestFlow Student'
            const eventTitle = reg.events?.title || 'Campus Event'
            const venueName = reg.events?.venue_name || 'Campus Venue'
            const ticketCode = reg.ticket_code || res.ticket_code || ''

            if (recipientEmail) {
              if (decision === 'approved') {
                sendPaymentApprovedEmail({
                  to: recipientEmail,
                  name: recipientName,
                  eventTitle,
                  ticketCode,
                  venueName,
                  registrationId: payData.registration_id,
                  eventId: payData.event_id,
                }).catch(() => {})

                sendTicketIssuedEmail({
                  to: recipientEmail,
                  name: recipientName,
                  eventTitle,
                  ticketCode,
                  venueName,
                  teamName: reg.team_name,
                  registrationId: payData.registration_id,
                  eventId: payData.event_id,
                }).catch(() => {})
              } else {
                sendPaymentRejectedEmail({
                  to: recipientEmail,
                  name: recipientName,
                  eventTitle,
                  reason: notes || 'Transaction reference could not be verified in organizer account.',
                  registrationId: payData.registration_id,
                  eventId: payData.event_id,
                }).catch(() => {})
              }
            }
          }
        } catch {
          // non-blocking
        }
      }

      return res
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

      // Synchronize team squad registrations if applicable
      if (targetReg.team_id) {
        const squadRegs = localRegs.filter((r: any) => r.team_id === targetReg.team_id && r.id !== targetReg.id)
        for (const sReg of squadRegs) {
          sReg.status = 'confirmed'
          if (!sReg.ticket_issued_at) {
            sReg.ticket_issued_at = new Date().toISOString()
          }
          sReg.updated_at = new Date().toISOString()
          sendTicketIssuedEmail({
            to: sReg.participant_details?.email || 'teammate@campus.edu',
            name: sReg.participant_details?.student_name || 'Squad Member',
            eventTitle: 'Campus Event',
            ticketCode: sReg.ticket_code || 'TKT-CONFIRMED',
            venueName: 'Campus Venue',
            teamName: targetReg.team_name,
            registrationId: sReg.id,
            eventId: sReg.event_id,
          }).catch(() => {})
        }
      }
    } else {
      targetReg.status = 'rejected'
      if (targetReg.team_id) {
        const squadRegs = localRegs.filter((r: any) => r.team_id === targetReg.team_id && r.id !== targetReg.id)
        for (const sReg of squadRegs) {
          sReg.status = 'rejected'
          sReg.updated_at = new Date().toISOString()
        }
      }
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

  // Trigger lifecycle email with dynamic recipient
  const reviewRecipientEmail = targetReg?.participant_details?.email || 'student@campus.edu'
  const reviewRecipientName = targetReg?.participant_details?.student_name || 'FestFlow Student'
  const reviewEventTitle = 'Campus Event'

  if (decision === 'approved') {
    sendPaymentApprovedEmail({
      to: reviewRecipientEmail,
      name: reviewRecipientName,
      eventTitle: reviewEventTitle,
      ticketCode: issuedTicketCode || 'TKT-CONFIRMED',
      venueName: 'Campus Venue',
      registrationId: targetSub.registration_id,
      eventId: targetSub.event_id,
    }).catch(() => {})

    sendTicketIssuedEmail({
      to: reviewRecipientEmail,
      name: reviewRecipientName,
      eventTitle: reviewEventTitle,
      ticketCode: issuedTicketCode || 'TKT-CONFIRMED',
      venueName: 'Campus Venue',
      registrationId: targetSub.registration_id,
      eventId: targetSub.event_id,
    }).catch(() => {})
  } else {
    sendPaymentRejectedEmail({
      to: reviewRecipientEmail,
      name: reviewRecipientName,
      eventTitle: reviewEventTitle,
      reason: notes || 'Transaction reference could not be verified in organizer account.',
      registrationId: targetSub.registration_id,
      eventId: targetSub.event_id,
    }).catch(() => {})
  }

  // Broadcast realtime status change
  broadcastStatusChange({
    type: 'payment_reviewed',
    registrationId: targetSub.registration_id,
    eventId: targetSub.event_id,
    studentId: targetSub.student_id,
    payload: { status: decision, notes },
  })
  broadcastStatusChange({
    type: 'registration_updated',
    registrationId: targetSub.registration_id,
    eventId: targetSub.event_id,
    studentId: targetSub.student_id,
  })
  broadcastStatusChange({
    type: 'ticket_updated',
    registrationId: targetSub.registration_id,
    eventId: targetSub.event_id,
    studentId: targetSub.student_id,
  })

  return {
    success: true,
    message: decision === 'approved' ? 'Payment approved and digital ticket confirmed successfully.' : 'Payment rejected with notes.',
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
        const { data: clubEvents } = await supabase
          .from('events')
          .select('id')
          .eq('club_id', clubId)

        const eventsList = (clubEvents || []) as Array<{ id: string }>
        if (eventsList.length === 0) {
          return { submissions: [] }
        }
        const eventIds = eventsList.map((e) => e.id)
        query = query.in('event_id', eventIds)
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
    return notifs.filter((n) => n.user_id === userId)
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
