export interface CalendarEventData {
  title: string
  description?: string
  startDate: string // ISO 8601
  endDate?: string // ISO 8601
  location?: string
  url?: string
}

/**
 * Formats a Date object or ISO string to Google Calendar / iCal UTC timestamp format:
 * YYYYMMDDTHHmmssZ
 */
function formatUtcForCalendar(isoDate: string, fallbackHours = 2): string {
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) {
      const fallback = new Date(Date.now() + fallbackHours * 3600 * 1000)
      return fallback.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    }
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  } catch {
    const fallback = new Date()
    return fallback.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }
}

/**
 * Generates an Add to Google Calendar URL with zero external dependencies.
 */
export function generateGoogleCalendarUrl(data: CalendarEventData): string {
  const startUtc = formatUtcForCalendar(data.startDate)
  let endUtc = data.endDate ? formatUtcForCalendar(data.endDate) : ''

  if (!endUtc) {
    // Default to start + 3 hours if no end date provided
    const sDate = new Date(data.startDate)
    const eDate = new Date(sDate.getTime() + 3 * 3600 * 1000)
    endUtc = eDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  const detailsParts = [
    data.description || 'Campus Event on FestFlow',
    data.url ? `\nEvent Link & Pass: ${data.url}` : '',
  ]

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: data.title,
    dates: `${startUtc}/${endUtc}`,
    details: detailsParts.join(''),
    location: data.location || 'Campus Venue',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Generates and downloads a standard RFC 5545 .ics iCalendar file.
 */
export function downloadIcsFile(data: CalendarEventData, filename?: string): void {
  const startUtc = formatUtcForCalendar(data.startDate)
  let endUtc = data.endDate ? formatUtcForCalendar(data.endDate) : ''

  if (!endUtc) {
    const sDate = new Date(data.startDate)
    const eDate = new Date(sDate.getTime() + 3 * 3600 * 1000)
    endUtc = eDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }

  const cleanTitle = (data.title || 'FestFlow Campus Event').replace(/[,\n]/g, ' ')
  const cleanDesc = (data.description || '').replace(/\n/g, '\\n').replace(/,/g, '\\,')
  const cleanLoc = (data.location || 'Campus Venue').replace(/[,\n]/g, ' ')
  const uid = `ff-${Date.now()}-${Math.random().toString(36).substring(2, 9)}@festflow.online`

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FestFlow//FestFlow Event Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatUtcForCalendar(new Date().toISOString())}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${cleanTitle}`,
    `DESCRIPTION:${cleanDesc}`,
    `LOCATION:${cleanLoc}`,
    data.url ? `URL:${data.url}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

