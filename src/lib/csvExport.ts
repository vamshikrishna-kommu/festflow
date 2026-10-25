import type {
  EventRecord,
  RegistrationWithStudent,
  PaymentSubmissionWithDetails,
  RegistrationWithCheckIn,
} from '@/types'

/**
 * Escapes CSV cell to prevent formula injection (CSV Injection / DDE vulnerability).
 * If a cell begins with '=', '+', '-', '@', '\t', or '\r', prefix with a single quote.
 * Doubles any internal quotes and encloses in quotation marks if delimiters are present.
 */
export function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""'
  let str = String(val).trim()

  // Prevent formula injection
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r']
  if (dangerousChars.some((char) => str.startsWith(char))) {
    str = `'${str}`
  }

  // Escape double quotes by doubling them
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Triggers a browser download of a UTF-8 encoded CSV file.
 */
export function downloadCsv(filename: string, rows: string[][]): void {
  // Prepend UTF-8 Byte Order Mark (BOM) for Excel compatibility
  const csvContent =
    '\uFEFF' +
    rows
      .map((row) => row.map(sanitizeCsvCell).join(','))
      .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

// ── 1. Full Event Registration List Export ──────────────────────────────────
export function exportRegistrationsListCsv(
  event: EventRecord,
  registrations: RegistrationWithStudent[]
): void {
  const headers = [
    'Registration ID',
    'Ticket Code',
    'Attendee Name',
    'Attendee Email',
    'Registration Status',
    'Ticket Price (INR)',
    'Registered At',
    'Ticket Issued At',
  ]

  const rows: string[][] = [headers]

  registrations.forEach((reg) => {
    rows.push([
      reg.id,
      reg.ticket_code || 'N/A',
      reg.student?.display_name || 'Student',
      reg.student?.email || 'N/A',
      reg.status.toUpperCase(),
      event.is_free ? '0' : String(event.price),
      new Date(reg.created_at).toLocaleString(),
      reg.ticket_issued_at ? new Date(reg.ticket_issued_at).toLocaleString() : 'Not Issued',
    ])
  })

  const filename = `festflow-${event.slug}-registrations-${getTodayString()}.csv`
  downloadCsv(filename, rows)
}

// ── 2. Confirmed Attendees Export ───────────────────────────────────────────
export function exportConfirmedAttendeesCsv(
  event: EventRecord,
  registrations: RegistrationWithStudent[]
): void {
  const confirmed = registrations.filter((r) => r.status === 'confirmed')

  const headers = [
    'Ticket Reference',
    'Attendee Name',
    'Email',
    'Event Title',
    'Venue',
    'Pass Confirmed At',
  ]

  const rows: string[][] = [headers]

  confirmed.forEach((reg) => {
    rows.push([
      reg.ticket_code || 'N/A',
      reg.student?.display_name || 'Student',
      reg.student?.email || 'N/A',
      event.title,
      event.venue_name,
      reg.ticket_issued_at ? new Date(reg.ticket_issued_at).toLocaleString() : 'Confirmed',
    ])
  })

  const filename = `festflow-${event.slug}-confirmed-attendees-${getTodayString()}.csv`
  downloadCsv(filename, rows)
}

// ── 3. Payment Reconciliation Report Export ─────────────────────────────────
export function exportPaymentReconciliationCsv(
  event: EventRecord,
  submissions: PaymentSubmissionWithDetails[]
): void {
  const headers = [
    'Submission ID',
    'Registration Reference',
    'Student Name',
    'Student Email',
    'Amount (INR)',
    'Payment Status',
    'Transaction Reference (UTR)',
    'Submission Timestamp',
    'Review Timestamp',
    'Reviewer Notes',
  ]

  const rows: string[][] = [headers]

  submissions.forEach((sub) => {
    rows.push([
      sub.id,
      sub.registration?.ticket_code || sub.registration_id,
      sub.student?.display_name || 'Student',
      sub.student?.email || 'N/A',
      String(sub.amount),
      sub.status.toUpperCase(),
      sub.transaction_reference,
      new Date(sub.submitted_at).toLocaleString(),
      sub.reviewed_at ? new Date(sub.reviewed_at).toLocaleString() : 'Pending',
      sub.review_notes || '',
    ])
  })

  const filename = `festflow-${event.slug}-payments-reconciliation-${getTodayString()}.csv`
  downloadCsv(filename, rows)
}

// ── 4. Attendance & Check-In Report Export ───────────────────────────────────
export function exportAttendanceReportCsv(
  event: EventRecord,
  attendees: RegistrationWithCheckIn[]
): void {
  const headers = [
    'Ticket Code',
    'Attendee Name',
    'Attendee Email',
    'Registration Status',
    'Gate Admitted',
    'Check-In Timestamp',
    'Check-In Notes',
  ]

  const rows: string[][] = [headers]

  attendees.forEach((att) => {
    const isCheckedIn = Boolean(att.check_in)
    rows.push([
      att.ticket_code || 'N/A',
      att.student?.display_name || 'Student',
      att.student?.email || 'N/A',
      att.status.toUpperCase(),
      isCheckedIn ? 'YES' : 'NO',
      att.check_in?.checked_in_at
        ? new Date(att.check_in.checked_in_at).toLocaleString()
        : 'Not Admitted',
      att.check_in?.checkin_notes || '',
    ])
  })

  const filename = `festflow-${event.slug}-attendance-checkin-${getTodayString()}.csv`
  downloadCsv(filename, rows)
}
