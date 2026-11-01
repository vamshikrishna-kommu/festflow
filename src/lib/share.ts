export interface EventSharePayload {
  title: string
  clubName?: string
  date?: string
  venue?: string
  url: string
}

export function generateWhatsAppShareUrl(payload: EventSharePayload): string {
  const text = `Hey! Check out "${payload.title}"${payload.clubName ? ` by ${payload.clubName}` : ''}${payload.date ? ` on ${payload.date}` : ''}${payload.venue ? ` at ${payload.venue}` : ''}.\n\nRegister & view digital pass on FestFlow:\n${payload.url}`
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
}

export function generateTwitterShareUrl(payload: EventSharePayload): string {
  const text = `Excited for "${payload.title}" on @FestFlow! Register now:`
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(payload.url)}`
}

export function generateLinkedInShareUrl(payload: EventSharePayload): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(payload.url)}`
}

export async function shareEventNative(payload: EventSharePayload): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: payload.title,
        text: `Check out ${payload.title} on FestFlow:`,
        url: payload.url,
      })
      return true
    } catch {
      // user aborted or not supported
      return false
    }
  }
  return false
}

