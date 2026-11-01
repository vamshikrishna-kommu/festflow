import type { EventCertificateRecord, CertificateTemplateRecord, StudentBadgeRecord } from '@/types'

/**
 * Draws the high-resolution A4 landscape certificate onto an HTML5 Canvas.
 * Resolution: 2400 x 1700 (High-definition print scale)
 */
export async function renderCertificateToCanvas(
  canvas: HTMLCanvasElement,
  cert: EventCertificateRecord,
  template?: CertificateTemplateRecord | null,
  qrImageElement?: HTMLImageElement | SVGElement | null
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const width = 2400
  const height = 1700
  canvas.width = width
  canvas.height = height

  // 1. Background Fill & Gradient
  const isMinimal = template?.theme === 'minimal_ivory'
  if (isMinimal) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
  } else {
    // Deep Obsidian Dark Luxury Background
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#08080A')
    bgGrad.addColorStop(0.5, '#0E0E14')
    bgGrad.addColorStop(1, '#12121C')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)
  }

  // 2. Corner Guilloche / Radial Glow Accents
  if (!isMinimal) {
    // Top-left brand cyan radial glow
    const tlGlow = ctx.createRadialGradient(0, 0, 100, 0, 0, 800)
    tlGlow.addColorStop(0, 'rgba(24, 207, 252, 0.12)')
    tlGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = tlGlow
    ctx.fillRect(0, 0, 900, 900)

    // Bottom-right vibrant violet radial glow
    const brGlow = ctx.createRadialGradient(width, height, 100, width, height, 900)
    brGlow.addColorStop(0, 'rgba(127, 26, 251, 0.12)')
    brGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = brGlow
    ctx.fillRect(width - 1000, height - 1000, 1000, 1000)
  }

  // 3. Double Outer & Inner Ornamental Borders
  const borderColor1 = isMinimal ? '#E2E8F0' : 'rgba(255, 255, 255, 0.15)'
  const borderColorGold = template?.theme === 'radiant_magenta'
    ? '#ED47FC'
    : template?.theme === 'cyan_cobalt'
    ? '#18CFFC'
    : template?.theme === 'royal_violet'
    ? '#7F1AFB'
    : '#F59E0B' // Gold

  // Outer border
  ctx.strokeStyle = borderColor1
  ctx.lineWidth = 3
  ctx.strokeRect(60, 60, width - 120, height - 120)

  // Inner border
  ctx.strokeStyle = borderColorGold
  ctx.lineWidth = 6
  ctx.strokeRect(80, 80, width - 160, height - 160)

  // Decorative Corner Brackets
  const cornerSize = 50
  ctx.lineWidth = 8
  ctx.strokeStyle = borderColorGold
  // Top-left
  ctx.beginPath()
  ctx.moveTo(80, 80 + cornerSize)
  ctx.lineTo(80, 80)
  ctx.lineTo(80 + cornerSize, 80)
  ctx.stroke()
  // Top-right
  ctx.beginPath()
  ctx.moveTo(width - 80 - cornerSize, 80)
  ctx.lineTo(width - 80, 80)
  ctx.lineTo(width - 80, 80 + cornerSize)
  ctx.stroke()
  // Bottom-left
  ctx.beginPath()
  ctx.moveTo(80, height - 80 - cornerSize)
  ctx.lineTo(80, height - 80)
  ctx.lineTo(80 + cornerSize, height - 80)
  ctx.stroke()
  // Bottom-right
  ctx.beginPath()
  ctx.moveTo(width - 80 - cornerSize, height - 80)
  ctx.lineTo(width - 80, height - 80)
  ctx.lineTo(width - 80, height - 80 - cornerSize)
  ctx.stroke()

  // 4. Microtext Security Border
  ctx.fillStyle = isMinimal ? '#94A3B8' : 'rgba(255, 255, 255, 0.25)'
  ctx.font = 'bold 12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(
    '• FESTFLOW 2.0 OFFICIAL VERIFIABLE CREDENTIAL • AUTHENTICITY VALIDATED AT FESTFLOW.ONLINE • TAMPER-EVIDENT CRYPTOGRAPHIC LEDGER •',
    width / 2,
    73
  )
  ctx.fillText(
    `• VERIFICATION ID: ${cert.certificate_number} • TOKEN: ${cert.verification_token.substring(0, 16)}... •`,
    width / 2,
    height - 68
  )

  // 5. Header: Issuing Club & FestFlow Verified Mark
  ctx.textAlign = 'center'
  ctx.fillStyle = isMinimal ? '#64748B' : '#94A3B8'
  ctx.font = 'bold 24px system-ui, sans-serif'
  ctx.fillText(cert.club_name.toUpperCase(), width / 2, 170)

  // 6. Category Heraldic Badge
  let badgeText = 'OFFICIAL EVENT CREDENTIAL'
  let badgeColor = '#07A4FC'
  if (cert.category === 'winner') {
    badgeText = '★ 1ST PLACE WINNER ★'
    badgeColor = '#F59E0B'
  } else if (cert.category === 'runner_up') {
    badgeText = '★ 2ND PLACE RUNNER-UP ★'
    badgeColor = '#94A3B8'
  } else if (cert.category === 'finalist') {
    badgeText = '★ EVENT FINALIST ★'
    badgeColor = '#ED47FC'
  } else if (cert.category === 'special_recognition') {
    badgeText = '★ SPECIAL RECOGNITION ★'
    badgeColor = '#7F1AFB'
  } else if (cert.category === 'merit') {
    badgeText = '★ CERTIFICATE OF MERIT ★'
    badgeColor = '#18CFFC'
  }

  // Draw pill behind badge
  const pillWidth = 420
  const pillHeight = 44
  ctx.fillStyle = isMinimal ? 'rgba(7, 164, 252, 0.1)' : 'rgba(255, 255, 255, 0.06)'
  ctx.beginPath()
  ctx.roundRect((width - pillWidth) / 2, 205, pillWidth, pillHeight, 22)
  ctx.fill()
  ctx.strokeStyle = badgeColor
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = badgeColor
  ctx.font = 'bold 18px monospace'
  ctx.fillText(badgeText, width / 2, 233)

  // 7. Certificate Main Title
  const title = template?.title_text || cert.title || 'CERTIFICATE OF PARTICIPATION'
  ctx.fillStyle = isMinimal ? '#0F172A' : '#FFFFFF'
  ctx.font = 'bold 64px "Syne", system-ui, sans-serif'
  ctx.fillText(title, width / 2, 340)

  // 8. Subtitle
  const subtitle = template?.subtitle_text || 'This prestigious credential is proudly presented to'
  ctx.fillStyle = isMinimal ? '#64748B' : '#A1A1AA'
  ctx.font = 'italic 26px system-ui, serif'
  ctx.fillText(subtitle, width / 2, 420)

  // 9. Recipient Name (Prominent & Elegant)
  const recipientName = cert.recipient_name || 'FestFlow Attendee'
  const nameGrad = ctx.createLinearGradient(width / 2 - 300, 0, width / 2 + 300, 0)
  if (isMinimal) {
    nameGrad.addColorStop(0, '#0D56FB')
    nameGrad.addColorStop(1, '#7F1AFB')
  } else {
    nameGrad.addColorStop(0, '#18CFFC')
    nameGrad.addColorStop(0.5, '#FFFFFF')
    nameGrad.addColorStop(1, '#ED47FC')
  }
  ctx.fillStyle = nameGrad
  ctx.font = 'bold 84px "Syne", system-ui, sans-serif'
  ctx.fillText(recipientName, width / 2, 530)

  // Underline beneath recipient name
  const underGrad = ctx.createLinearGradient(width / 2 - 400, 0, width / 2 + 400, 0)
  underGrad.addColorStop(0, 'transparent')
  underGrad.addColorStop(0.5, borderColorGold)
  underGrad.addColorStop(1, 'transparent')
  ctx.strokeStyle = underGrad
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(width / 2 - 420, 560)
  ctx.lineTo(width / 2 + 420, 560)
  ctx.stroke()

  // Recipient College / Institution
  if (cert.recipient_college) {
    ctx.fillStyle = isMinimal ? '#64748B' : '#94A3B8'
    ctx.font = 'bold 24px system-ui, sans-serif'
    ctx.fillText(cert.recipient_college.toUpperCase(), width / 2, 605)
  }

  // 10. Body Paragraph
  const eventDateFormatted = new Date(cert.issue_date).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  let bodyText = template?.body_template || 'for outstanding participation and successful completion of {event_title} organized by {club_name} on {event_date}.'
  bodyText = bodyText
    .replace(/{event_title}/g, `"${cert.event_title}"`)
    .replace(/{club_name}/g, cert.club_name)
    .replace(/{event_date}/g, eventDateFormatted)
    .replace(/{recipient_name}/g, recipientName)

  // Wrap body text nicely
  ctx.fillStyle = isMinimal ? '#334155' : '#D4D4D8'
  ctx.font = '28px system-ui, sans-serif'
  const maxWidth = 1600
  const words = bodyText.split(' ')
  let line = ''
  let y = 675
  const lineHeight = 46

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, width / 2, y)
      line = words[n] + ' '
      y += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, width / 2, y)

  // 11. Lower Section: Signatories & Verification QR
  const bottomY = 1250

  // Signatory 1 (Left)
  const sig1Name = template?.signatory_1_name || 'Dr. Faculty Convener'
  const sig1Role = template?.signatory_1_role || 'Faculty Advisor & Head of Dept'
  ctx.strokeStyle = isMinimal ? '#94A3B8' : 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(300, bottomY + 120)
  ctx.lineTo(750, bottomY + 120)
  ctx.stroke()

  ctx.fillStyle = isMinimal ? '#0F172A' : '#FFFFFF'
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillText(sig1Name, 525, bottomY + 160)

  ctx.fillStyle = isMinimal ? '#64748B' : '#A1A1AA'
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillText(sig1Role, 525, bottomY + 195)

  // Signatory 2 (Right)
  const sig2Name = template?.signatory_2_name || 'Student Lead Organizer'
  const sig2Role = template?.signatory_2_role || 'Club President & Chairperson'
  ctx.beginPath()
  ctx.moveTo(width - 750, bottomY + 120)
  ctx.lineTo(width - 300, bottomY + 120)
  ctx.stroke()

  ctx.fillStyle = isMinimal ? '#0F172A' : '#FFFFFF'
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillText(sig2Name, width - 525, bottomY + 160)

  ctx.fillStyle = isMinimal ? '#64748B' : '#A1A1AA'
  ctx.font = '20px system-ui, sans-serif'
  ctx.fillText(sig2Role, width - 525, bottomY + 195)

  // Center: Official QR Turnstile & Verification Code Box
  const qrBoxX = width / 2 - 120
  const qrBoxY = bottomY - 30
  const qrBoxSize = 240

  // Draw white QR code container
  ctx.fillStyle = '#FFFFFF'
  ctx.beginPath()
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 16)
  ctx.fill()
  ctx.strokeStyle = borderColorGold
  ctx.lineWidth = 3
  ctx.stroke()

  // Draw QR Code Image if supplied, or generate fallback
  if (qrImageElement) {
    try {
      if (qrImageElement instanceof HTMLImageElement) {
        ctx.drawImage(qrImageElement, qrBoxX + 15, qrBoxY + 15, qrBoxSize - 30, qrBoxSize - 30)
      } else {
        const svgXml = new XMLSerializer().serializeToString(qrImageElement)
        const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' })
        const URL = window.URL || window.webkitURL || window
        const blobURL = URL.createObjectURL(svgBlob)
        const img = new Image()
        await new Promise<void>((resolve) => {
          img.onload = () => {
            ctx.drawImage(img, qrBoxX + 15, qrBoxY + 15, qrBoxSize - 30, qrBoxSize - 30)
            URL.revokeObjectURL(blobURL)
            resolve()
          }
          img.onerror = () => resolve()
          img.src = blobURL
        })
      }
    } catch {
      // ignore
    }
  }

  // Label Below QR
  ctx.fillStyle = isMinimal ? '#0D56FB' : '#18CFFC'
  ctx.font = 'bold 18px monospace'
  ctx.fillText(cert.certificate_number, width / 2, qrBoxY + qrBoxSize + 35)

  ctx.fillStyle = isMinimal ? '#64748B' : '#94A3B8'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText('Scan to verify authentic certificate on FestFlow', width / 2, qrBoxY + qrBoxSize + 60)
  ctx.fillText(`Issued: ${eventDateFormatted}`, width / 2, qrBoxY + qrBoxSize + 85)

  // If certificate is revoked, render conspicuous watermark stamp across certificate
  if (cert.status === 'revoked') {
    ctx.save()
    ctx.translate(width / 2, height / 2)
    ctx.rotate(-0.35)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'
    ctx.strokeStyle = '#EF4444'
    ctx.lineWidth = 14
    ctx.strokeRect(-600, -120, 1200, 240)
    ctx.fillRect(-600, -120, 1200, 240)

    ctx.fillStyle = '#EF4444'
    ctx.font = 'bold 110px "Syne", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('REVOKED CREDENTIAL', 0, 35)
    ctx.restore()
  }
}

/**
 * Downloads the high-resolution certificate as a PNG file.
 */
export async function downloadCertificatePng(
  cert: EventCertificateRecord,
  template?: CertificateTemplateRecord | null,
  qrElement?: HTMLImageElement | SVGElement | null
): Promise<void> {
  const canvas = document.createElement('canvas')
  await renderCertificateToCanvas(canvas, cert, template, qrElement)

  const link = document.createElement('a')
  link.download = `FestFlow-Certificate-${cert.certificate_number}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

/**
 * Generates an attractive 1080x1080 square social achievement card for LinkedIn/Instagram.
 */
export async function downloadAchievementCardPng(
  cert: EventCertificateRecord,
  badge?: StudentBadgeRecord | null
): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080)
  bg.addColorStop(0, '#08080A')
  bg.addColorStop(0.5, '#0E0E14')
  bg.addColorStop(1, '#1A102E')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 1080, 1080)

  // Decorative glow
  const glow = ctx.createRadialGradient(540, 300, 50, 540, 300, 500)
  glow.addColorStop(0, 'rgba(24, 207, 252, 0.18)')
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 1080, 800)

  // Border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.lineWidth = 4
  ctx.strokeRect(40, 40, 1000, 1000)

  // FestFlow Logo Pill
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.beginPath()
  ctx.roundRect(390, 80, 300, 44, 22)
  ctx.fill()
  ctx.strokeStyle = '#18CFFC'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.fillStyle = '#18CFFC'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('FESTFLOW CREDENTIAL', 540, 108)

  // Trophy / Heraldic Icon
  ctx.font = '72px system-ui'
  ctx.fillText(badge?.category === 'awards' ? '🏆' : '🎓', 540, 230)

  // Title
  ctx.fillStyle = '#ED47FC'
  ctx.font = 'bold 22px monospace'
  ctx.fillText(cert.category.replace(/_/g, ' ').toUpperCase(), 540, 290)

  // Student Name
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 54px "Syne", system-ui, sans-serif'
  ctx.fillText(cert.recipient_name, 540, 370)

  if (cert.recipient_college) {
    ctx.fillStyle = '#94A3B8'
    ctx.font = '20px system-ui, sans-serif'
    ctx.fillText(cert.recipient_college, 540, 415)
  }

  // Divider line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(200, 455)
  ctx.lineTo(880, 455)
  ctx.stroke()

  // Event & Club Box
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'
  ctx.beginPath()
  ctx.roundRect(140, 490, 800, 200, 20)
  ctx.fill()
  ctx.strokeStyle = 'rgba(127, 26, 251, 0.3)'
  ctx.stroke()

  ctx.fillStyle = '#94A3B8'
  ctx.font = '16px monospace'
  ctx.fillText('EVENT ACCOMPLISHMENT', 540, 535)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 32px "Syne", system-ui, sans-serif'
  const evTitle = cert.event_title.length > 36 ? cert.event_title.substring(0, 34) + '…' : cert.event_title
  ctx.fillText(evTitle, 540, 585)

  ctx.fillStyle = '#18CFFC'
  ctx.font = '22px system-ui, sans-serif'
  ctx.fillText(`Presented by ${cert.club_name}`, 540, 635)

  // Verification Credentials Footer
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 20px monospace'
  ctx.fillText(`CERTIFICATE: ${cert.certificate_number}`, 540, 780)

  ctx.fillStyle = '#A1A1AA'
  ctx.font = '16px system-ui, sans-serif'
  ctx.fillText(`Issued on ${new Date(cert.issue_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, 540, 815)
  ctx.fillText('Verify authenticity at festflow.online', 540, 850)

  // Bottom brand banner
  ctx.fillStyle = '#18CFFC'
  ctx.font = 'bold 20px monospace'
  ctx.fillText('festflow.online', 540, 960)

  const link = document.createElement('a')
  link.download = `FestFlow-Achievement-${cert.certificate_number}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

