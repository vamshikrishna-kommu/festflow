import ExcelJS from 'exceljs'
import type {
  EventRecord,
  RegistrationWithStudent,
  RegistrationWithCheckIn,
  PaymentSubmissionWithDetails,
  CheckInRecord,
  CustomQuestion,
} from '@/types'

/**
 * Escapes cell values to prevent formula injection (CSV/Excel Formula Injection / DDE vulnerability).
 * If a cell string begins with '=', '+', '-', '@', '\t', or '\r', prefix with a single quote.
 */
export function sanitizeExcelValue(val: any): string | number | boolean | null {
  if (val === null || val === undefined) return ''
  if (typeof val === 'number') {
    if (isNaN(val)) return ''
    return val
  }
  if (typeof val === 'boolean') return val

  const rawStr = String(val)
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r']
  if (dangerousChars.some((char) => rawStr.startsWith(char) || rawStr.trim().startsWith(char))) {
    return `'${rawStr}`
  }
  return rawStr.trim()
}

/**
 * Formats ISO date string to readable IST date-time.
 */
export function formatExcelDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return String(dateStr)
  }
}

/**
 * Helper to get clean today string for filenames (YYYY-MM-DD).
 */
export function getExportDateSlug(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Applies professional styling to an ExcelJS worksheet:
 * - Freezes header row
 * - Enables autofilters on data table
 * - Dark Navy header fill with bold white typography
 * - Alternate row striping (zebra)
 * - Clean thin borders
 * - Auto-adjusted column widths with min/max caps
 */
export function applyWorksheetStyling(
  worksheet: ExcelJS.Worksheet,
  headerRowNumber: number,
  numCols: number
): void {
  // 1. Freeze header view
  worksheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: headerRowNumber,
      activeCell: `A${headerRowNumber + 1}`,
    },
  ]

  // 2. Enable Autofilter
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: headerRowNumber, column: numCols },
  }

  // 3. Style Table Header Row
  const headerRow = worksheet.getRow(headerRowNumber)
  headerRow.height = 28
  headerRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }, // Slate 900
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: false,
    }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF334155' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    }
  })

  // 4. Style Data Rows (Zebra striping and clean borders)
  const totalRows = worksheet.rowCount
  for (let r = headerRowNumber + 1; r <= totalRows; r++) {
    const row = worksheet.getRow(r)
    row.height = 22
    const isEven = (r - headerRowNumber) % 2 === 0
    const rowFillColor = isEven ? 'FFF8FAFC' : 'FFFFFFFF'

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= numCols) {
        cell.font = { name: 'Calibri', size: 10 }
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowFillColor },
        }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: cell.alignment?.horizontal || 'left',
        }
      }
    })
  }

  // 5. Auto-fit column widths
  worksheet.columns.forEach((column) => {
    let maxLength = 12
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      // Don't size based on title rows
      if (rowNumber >= headerRowNumber) {
        const valStr = cell.value ? String(cell.value) : ''
        if (valStr.length > maxLength) {
          maxLength = valStr.length
        }
      }
    })
    column.width = Math.min(Math.max(maxLength + 3, 12), 45)
  })
}

/**
 * Triggers a browser download of an ExcelJS workbook.
 */
export async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Universal browser download (desktop & mobile)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()

  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 1000)
}

// ── 1. Full Attendee Directory Workbook Builder ─────────────────────────────
export async function buildFullAttendeesWorkbook(params: {
  event: EventRecord
  registrations: (RegistrationWithStudent | RegistrationWithCheckIn)[]
  checkIns?: CheckInRecord[]
  payments?: PaymentSubmissionWithDetails[]
  isAuthorized: boolean
}): Promise<ExcelJS.Workbook> {
  const { event, registrations, checkIns = [], payments = [], isAuthorized } = params

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FestFlow Campus Event Management'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Attendee Directory', {
    pageSetup: { orientation: 'landscape' },
  })

  // Map latest check-in per registration
  const checkInMap = new Map<string, CheckInRecord>()
  checkIns.forEach((c) => {
    if (!checkInMap.has(c.registration_id)) {
      checkInMap.set(c.registration_id, c)
    }
  })

  // Map payments by registration
  const paymentMap = new Map<string, PaymentSubmissionWithDetails>()
  payments.forEach((p) => {
    if (!paymentMap.has(p.registration_id)) {
      paymentMap.set(p.registration_id, p)
    }
  })

  // Extract event custom questions if defined
  const customQuestions: CustomQuestion[] = Array.isArray((event as any).custom_questions)
    ? (event as any).custom_questions
    : []

  // Top Metadata Block
  worksheet.addRow([`FestFlow Attendee Directory: ${event.title}`])
  worksheet.addRow([
    `Venue: ${event.venue_name || 'Campus Venue'}  |  Date: ${formatExcelDateTime(event.start_date)}  |  Category: ${(event.category || 'General').toUpperCase()}`,
  ])
  worksheet.addRow([
    `Export Date: ${formatExcelDateTime(new Date().toISOString())}  |  Total Registrations: ${registrations.length}  |  Capacity: ${event.capacity} seats`,
  ])
  worksheet.addRow([]) // Spacer row

  // Style Metadata Header Block
  const titleCell = worksheet.getCell('A1')
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } }
  worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } }

  // Define Table Headers
  const baseHeaders = [
    '#',
    'Registration ID',
    'Ticket Reference',
    'Attendee Name',
    'Attendee Email',
    'Phone',
    'College / Institute',
    'Department / Branch',
    'Year of Study',
    'Participation Mode',
    'Team Name',
    'Team Role',
    'Registration Status',
    'Payment Status',
    'Gate Check-In Status',
    'First Check-In Time',
    'Last Check-Out Time',
    'Total Gate Admissions',
    'Registered At',
    'Ticket Issued At',
  ]

  // Append dynamic headers for custom questions
  customQuestions.forEach((q) => {
    baseHeaders.push(`Question: ${q.label || q.id}`)
  })

  // Append payment review details only if authorized organizer
  if (isAuthorized && !event.is_free) {
    baseHeaders.push('Payment UTR / Ref', 'Amount Paid (INR)', 'Payment Verified At')
  }

  const headerRowNumber = 5
  worksheet.addRow(baseHeaders)

  // Populate Attendee Data Rows
  registrations.forEach((reg, index) => {
    const student = (reg as any).student || null
    const studentProfile = (reg as any).student_profile || student?.student_profile || null
    const checkInRecord = checkInMap.get(reg.id) || (reg as any).check_in || null
    const paymentRecord = paymentMap.get(reg.id) || null

    const hasTeam = Boolean(reg.team_name || (reg as any).team_id)
    const isTeamLeader = hasTeam && !(reg as any).is_team_member

    // Gate Status resolution
    let gateStatus = 'Not Arrived'
    if (reg.status === 'cancelled') {
      gateStatus = 'Cancelled Pass'
    } else if (reg.status === 'rejected' || reg.status === 'pending_approval' || reg.status === 'pending_payment') {
      gateStatus = 'Ineligible'
    } else if (checkInRecord) {
      gateStatus = checkInRecord.status === 'checked_out' ? 'Checked Out' : 'Admitted Inside'
    }

    // Payment Status resolution
    let paymentStatus = event.is_free ? 'Complimentary' : 'Pending Payment'
    if (!event.is_free) {
      if (paymentRecord?.status === 'approved' || reg.status === 'confirmed') {
        paymentStatus = 'Verified / Paid'
      } else if (paymentRecord?.status === 'pending_review' || reg.status === 'pending_payment') {
        paymentStatus = 'Under Verification'
      } else if (paymentRecord?.status === 'rejected') {
        paymentStatus = 'Payment Rejected'
      }
    }

    const rowData: (string | number | boolean | null)[] = [
      index + 1,
      sanitizeExcelValue(reg.id),
      sanitizeExcelValue(reg.ticket_code || '—'),
      sanitizeExcelValue(student?.display_name || (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')),
      sanitizeExcelValue(student?.email || '—'),
      sanitizeExcelValue(studentProfile?.phone || (reg as any).phone || '—'),
      sanitizeExcelValue(studentProfile?.college || (reg as any).college || '—'),
      sanitizeExcelValue(studentProfile?.department || (reg as any).department || '—'),
      sanitizeExcelValue(studentProfile?.year_of_study ? `Year ${studentProfile.year_of_study}` : '—'),
      hasTeam ? 'Team Participation' : 'Individual',
      sanitizeExcelValue(reg.team_name || '—'),
      hasTeam ? (isTeamLeader ? 'Team Leader' : 'Team Member') : 'Solo',
      sanitizeExcelValue(reg.status.toUpperCase()),
      paymentStatus,
      gateStatus,
      checkInRecord ? formatExcelDateTime(checkInRecord.checked_in_at) : '—',
      checkInRecord?.checked_out_at ? formatExcelDateTime(checkInRecord.checked_out_at) : '—',
      checkInRecord ? (checkInRecord.entry_count || 1) : 0,
      formatExcelDateTime(reg.created_at),
      reg.ticket_issued_at ? formatExcelDateTime(reg.ticket_issued_at) : '—',
    ]

    // Populate Custom Question Answers
    const customResponses: Record<string, any> = (reg as any).custom_responses || {}
    customQuestions.forEach((q) => {
      const answerVal = customResponses[q.id] ?? customResponses[q.label]
      if (answerVal === null || answerVal === undefined) {
        rowData.push('—')
      } else if (typeof answerVal === 'boolean') {
        rowData.push(answerVal ? 'Yes' : 'No')
      } else if (Array.isArray(answerVal)) {
        rowData.push(sanitizeExcelValue(answerVal.join(', ')))
      } else {
        rowData.push(sanitizeExcelValue(String(answerVal)))
      }
    })

    // Populate Authorized Payment Info
    if (isAuthorized && !event.is_free) {
      rowData.push(
        sanitizeExcelValue(paymentRecord?.transaction_reference || (paymentRecord as any)?.utr_number || (reg as any).payment_ref || '—'),
        paymentRecord?.amount || event.price || 0,
        paymentRecord?.reviewed_at ? formatExcelDateTime(paymentRecord.reviewed_at) : '—'
      )
    }

    worksheet.addRow(rowData)
  })

  // Apply visual styling, frozen panes, and auto-filters
  applyWorksheetStyling(worksheet, headerRowNumber, baseHeaders.length)

  return workbook
}

export async function exportFullAttendeesXlsx(params: {
  event: EventRecord
  registrations: (RegistrationWithStudent | RegistrationWithCheckIn)[]
  checkIns?: CheckInRecord[]
  payments?: PaymentSubmissionWithDetails[]
  isAuthorized: boolean
}): Promise<void> {
  const workbook = await buildFullAttendeesWorkbook(params)
  const filename = `FestFlow_${params.event.slug || 'event'}_Attendees_${getExportDateSlug()}.xlsx`
  await downloadWorkbook(workbook, filename)
}

// ── 2. Gate Attendance & Check-In Workbook Builder ──────────────────────────
export async function buildAttendanceWorkbook(params: {
  event: EventRecord
  registrations: (RegistrationWithStudent | RegistrationWithCheckIn)[]
  checkIns?: CheckInRecord[]
}): Promise<ExcelJS.Workbook> {
  const { event, registrations, checkIns = [] } = params

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FestFlow Campus Gate Operations'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Gate Attendance Log', {
    pageSetup: { orientation: 'landscape' },
  })

  // Calculate authoritative attendance figures
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length
  const totalScans = checkIns.length
  const insideCount = checkIns.filter((c) => c.status !== 'checked_out').length
  const checkedOutCount = checkIns.filter((c) => c.status === 'checked_out').length
  const turnoutRate = confirmedCount > 0 ? Math.round((insideCount / confirmedCount) * 100) : 0

  // Metadata Summary Block
  worksheet.addRow([`Gate Attendance & Turnstile Log: ${event.title}`])
  worksheet.addRow([
    `Venue: ${event.venue_name || 'Campus Venue'}  |  Event Date: ${formatExcelDateTime(event.start_date)}  |  Re-entry: ${event.allow_reentry ? 'Permitted' : 'Strict Single Entry'}`,
  ])
  worksheet.addRow([
    `Admitted Inside: ${insideCount}  |  Checked Out: ${checkedOutCount}  |  Total Scans: ${totalScans}  |  Confirmed: ${confirmedCount}  |  Turnout: ${turnoutRate}%`,
  ])
  worksheet.addRow([]) // Spacer row

  const titleCell = worksheet.getCell('A1')
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } }
  worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0284C7' } }

  const headers = [
    '#',
    'Ticket Reference',
    'Registration ID',
    'Attendee / Team Name',
    'Student Email',
    'Participation Type',
    'Gate Turnstile Status',
    'First Gate Check-In',
    'Last Gate Check-Out',
    'Total Admissions (Entry Count)',
    'Verified Operator ID',
    'Checkout Operator ID',
    'Operator Turnstile Notes',
  ]

  const headerRowNumber = 5
  worksheet.addRow(headers)

  // Map check-ins by registration ID
  const checkInMap = new Map<string, CheckInRecord>()
  checkIns.forEach((c) => {
    if (!checkInMap.has(c.registration_id)) {
      checkInMap.set(c.registration_id, c)
    }
  })

  registrations.forEach((reg, index) => {
    const student = (reg as any).student || null
    const checkInRecord = checkInMap.get(reg.id) || (reg as any).check_in || null

    let gateStatus = 'Not Arrived'
    if (reg.status === 'cancelled') {
      gateStatus = 'Cancelled'
    } else if (reg.status === 'rejected' || reg.status === 'pending_approval' || reg.status === 'pending_payment') {
      gateStatus = 'Ineligible'
    } else if (checkInRecord) {
      gateStatus = checkInRecord.status === 'checked_out' ? 'Checked Out' : 'Admitted Inside'
    }

    const rowData: (string | number | boolean | null)[] = [
      index + 1,
      sanitizeExcelValue(reg.ticket_code || '—'),
      sanitizeExcelValue(reg.id),
      sanitizeExcelValue(student?.display_name || (reg.team_name ? `Team ${reg.team_name}` : 'Student Attendee')),
      sanitizeExcelValue(student?.email || '—'),
      reg.team_name ? `Team: ${reg.team_name}` : 'Individual',
      gateStatus,
      checkInRecord ? formatExcelDateTime(checkInRecord.checked_in_at) : '—',
      checkInRecord?.checked_out_at ? formatExcelDateTime(checkInRecord.checked_out_at) : '—',
      checkInRecord ? (checkInRecord.entry_count || 1) : 0,
      sanitizeExcelValue(checkInRecord?.staff_id || '—'),
      sanitizeExcelValue(checkInRecord?.checked_out_by || '—'),
      sanitizeExcelValue(checkInRecord?.checkout_notes || checkInRecord?.checkin_notes || '—'),
    ]

    worksheet.addRow(rowData)
  })

  applyWorksheetStyling(worksheet, headerRowNumber, headers.length)

  return workbook
}

export async function exportAttendanceReportXlsx(params: {
  event: EventRecord
  registrations: (RegistrationWithStudent | RegistrationWithCheckIn)[]
  checkIns?: CheckInRecord[]
}): Promise<void> {
  const workbook = await buildAttendanceWorkbook(params)
  const filename = `FestFlow_${params.event.slug || 'event'}_Attendance_Report_${getExportDateSlug()}.xlsx`
  await downloadWorkbook(workbook, filename)
}

// ── 3. Squads & Member Rosters Workbook Builder ─────────────────────────────
export async function buildTeamsWorkbook(params: {
  event: EventRecord
  registrations: (RegistrationWithStudent | RegistrationWithCheckIn)[]
}): Promise<ExcelJS.Workbook> {
  const { event, registrations } = params

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FestFlow Campus Squad Management'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Squads & Rosters', {
    pageSetup: { orientation: 'landscape' },
  })

  const teamRegs = registrations.filter((r) => Boolean(r.team_name || (r as any).team_id))

  // Calculate unique squads count
  const uniqueSquads = new Set(teamRegs.map((r) => r.team_name || (r as any).team_id))

  worksheet.addRow([`Squads & Team Membership Report: ${event.title}`])
  worksheet.addRow([
    `Event: ${event.title}  |  Squad Capacity: ${event.min_team_size || 2}–${event.max_team_size || 4} Members  |  Category: ${(event.category || 'General').toUpperCase()}`,
  ])
  worksheet.addRow([
    `Export Date: ${formatExcelDateTime(new Date().toISOString())}  |  Total Squads: ${uniqueSquads.size}  |  Total Team Registrations: ${teamRegs.length}`,
  ])
  worksheet.addRow([]) // Spacer row

  const titleCell = worksheet.getCell('A1')
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } }
  worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF7C3AED' } }

  const headers = [
    '#',
    'Squad Name',
    'Squad Member Role',
    'Member Name',
    'Member Email',
    'Student Roll / ID',
    'College / Institute',
    'Contact Phone',
    'Squad Pass Code',
    'Pass Status',
    'Registered / Joined At',
  ]

  const headerRowNumber = 5
  worksheet.addRow(headers)

  let rowIndex = 1

  teamRegs.forEach((reg) => {
    const student = (reg as any).student || null
    const studentProfile = (reg as any).student_profile || null
    const teamMembers: any[] = Array.isArray((reg as any).team_members) ? (reg as any).team_members : []

    // 1. Leader Row
    worksheet.addRow([
      rowIndex++,
      sanitizeExcelValue(reg.team_name || 'Squad'),
      'Team Leader',
      sanitizeExcelValue(student?.display_name || 'Leader Attendee'),
      sanitizeExcelValue(student?.email || '—'),
      sanitizeExcelValue(studentProfile?.student_id || '—'),
      sanitizeExcelValue(studentProfile?.college || '—'),
      sanitizeExcelValue(studentProfile?.phone || '—'),
      sanitizeExcelValue(reg.ticket_code || '—'),
      sanitizeExcelValue(reg.status.toUpperCase()),
      formatExcelDateTime(reg.created_at),
    ])

    // 2. Team Member Rows
    teamMembers.forEach((member: any, mIdx: number) => {
      worksheet.addRow([
        rowIndex++,
        sanitizeExcelValue(reg.team_name || 'Squad'),
        `Squad Member #${mIdx + 1}`,
        sanitizeExcelValue(member.name || `Member ${mIdx + 1}`),
        sanitizeExcelValue(member.email || '—'),
        sanitizeExcelValue(member.studentId || '—'),
        sanitizeExcelValue(member.college || '—'),
        sanitizeExcelValue(member.phone || '—'),
        sanitizeExcelValue(member.ticket_code || `${reg.ticket_code}-M${mIdx + 1}`),
        sanitizeExcelValue(reg.status.toUpperCase()),
        formatExcelDateTime(member.created_at || reg.created_at),
      ])
    })
  })

  applyWorksheetStyling(worksheet, headerRowNumber, headers.length)

  return workbook
}

export async function exportTeamsReportXlsx(params: {
  event: EventRecord
  registrations: (RegistrationWithStudent | RegistrationWithCheckIn)[]
}): Promise<void> {
  const workbook = await buildTeamsWorkbook(params)
  const filename = `FestFlow_${params.event.slug || 'event'}_Teams_Roster_${getExportDateSlug()}.xlsx`
  await downloadWorkbook(workbook, filename)
}

// ── 4. Payment Reconciliation & UTR Review Workbook Builder ─────────────────
export async function buildPaymentsWorkbook(params: {
  event: EventRecord
  payments: PaymentSubmissionWithDetails[]
  isAuthorized: boolean
}): Promise<ExcelJS.Workbook> {
  const { event, payments, isAuthorized } = params

  if (!isAuthorized) {
    throw new Error('Unauthorized: Payment reconciliation reports are restricted to authorized club organizers.')
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'FestFlow Campus Payment Review'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Payment Reconciliation', {
    pageSetup: { orientation: 'landscape' },
  })

  const approvedList = payments.filter((p) => p.status === 'approved')
  const pendingList = payments.filter((p) => p.status === 'pending_review')
  const rejectedList = payments.filter((p) => p.status === 'rejected')
  const totalRevenue = approvedList.reduce((sum, p) => sum + (p.amount || 0), 0)

  worksheet.addRow([`Payment Audit & UTR Reconciliation: ${event.title}`])
  worksheet.addRow([
    `Ticket Price: ₹${event.price || 0}  |  Event Date: ${formatExcelDateTime(event.start_date)}  |  Category: ${(event.category || 'General').toUpperCase()}`,
  ])
  worksheet.addRow([
    `Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')}  |  Approved: ${approvedList.length}  |  Pending Review: ${pendingList.length}  |  Rejected: ${rejectedList.length}`,
  ])
  worksheet.addRow([]) // Spacer row

  const titleCell = worksheet.getCell('A1')
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F172A' } }
  worksheet.getCell('A2').font = { name: 'Calibri', size: 10, color: { argb: 'FF64748B' } }
  worksheet.getCell('A3').font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFD97706' } }

  const headers = [
    '#',
    'Payment ID',
    'Registration ID',
    'Payer / Team Name',
    'Payer Email',
    'Amount (INR)',
    'Payment Mode',
    'UTR / Transaction Reference',
    'Review Status',
    'Submitted Timestamp',
    'Reviewed Timestamp',
    'Reviewed By (Staff ID)',
    'Rejection / Review Notes',
  ]

  const headerRowNumber = 5
  worksheet.addRow(headers)

  payments.forEach((p, index) => {
    const student = p.student || null

    const rowData: (string | number | boolean | null)[] = [
      index + 1,
      sanitizeExcelValue(p.id),
      sanitizeExcelValue(p.registration_id),
      sanitizeExcelValue(student?.display_name || 'Payer Student'),
      sanitizeExcelValue(student?.email || '—'),
      p.amount || event.price || 0,
      'UPI / Dynamic QR',
      sanitizeExcelValue(p.transaction_reference || (p as any).utr_number || '—'),
      sanitizeExcelValue(p.status.toUpperCase()),
      formatExcelDateTime(p.submitted_at || p.created_at),
      p.reviewed_at ? formatExcelDateTime(p.reviewed_at) : '—',
      sanitizeExcelValue(p.reviewer_id || (p as any).reviewed_by || '—'),
      sanitizeExcelValue(p.review_notes || (p as any).rejection_reason || '—'),
    ]

    worksheet.addRow(rowData)
  })

  applyWorksheetStyling(worksheet, headerRowNumber, headers.length)

  return workbook
}

export async function exportPaymentsReportXlsx(params: {
  event: EventRecord
  payments: PaymentSubmissionWithDetails[]
  isAuthorized: boolean
}): Promise<void> {
  const workbook = await buildPaymentsWorkbook(params)
  const filename = `FestFlow_${params.event.slug || 'event'}_Payment_Reconciliation_${getExportDateSlug()}.xlsx`
  await downloadWorkbook(workbook, filename)
}
