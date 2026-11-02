// FestFlow Dynamic SEO and Schema.org Metadata Injector (Phase 9)
import { useEffect } from 'react'
import { getFrontendBaseUrl } from '@/lib/canonicalUrl'
import type { EventRecord } from '@/types'

export interface SEOHeadProps {
  title: string
  description?: string
  canonicalPath?: string
  ogImage?: string
  ogType?: 'website' | 'article' | 'profile'
  eventData?: EventRecord & { club_name?: string }
  noIndex?: boolean
}

export function SEOHead({
  title,
  description = 'FestFlow is the premier college event platform. Discover campus hackathons, fests, workshops, and manage digital passes.',
  canonicalPath = '',
  ogImage = '/festflow-logo.png',
  ogType = 'website',
  eventData,
  noIndex = false,
}: SEOHeadProps) {
  useEffect(() => {
    // 1. Update Document Title
    const fullTitle = title.includes('FestFlow') ? title : `${title} — FestFlow`
    document.title = fullTitle

    const baseUrl = getFrontendBaseUrl()
    const fullCanonical = `${baseUrl}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
    const fullImage = ogImage.startsWith('http') ? ogImage : `${baseUrl}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`

    // 2. Helper to set or update <meta> tags
    const setMetaTag = (attr: 'name' | 'property', key: string, content: string) => {
      let meta = document.querySelector(`meta[${attr}="${key}"]`)
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute(attr, key)
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', content)
    }

    setMetaTag('name', 'description', description)
    setMetaTag('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')

    // OpenGraph
    setMetaTag('property', 'og:title', fullTitle)
    setMetaTag('property', 'og:description', description)
    setMetaTag('property', 'og:url', fullCanonical)
    setMetaTag('property', 'og:image', fullImage)
    setMetaTag('property', 'og:type', ogType)
    setMetaTag('property', 'og:site_name', 'FestFlow')

    // Twitter / X
    setMetaTag('name', 'twitter:card', 'summary_large_image')
    setMetaTag('name', 'twitter:title', fullTitle)
    setMetaTag('name', 'twitter:description', description)
    setMetaTag('name', 'twitter:image', fullImage)

    // 3. Update Canonical Link tag
    let linkCanonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!linkCanonical) {
      linkCanonical = document.createElement('link')
      linkCanonical.setAttribute('rel', 'canonical')
      document.head.appendChild(linkCanonical)
    }
    linkCanonical.setAttribute('href', fullCanonical)

    // 4. Schema.org JSON-LD Structured Data for Events
    let scriptJsonLd = document.getElementById('festflow-schema-jsonld') as HTMLScriptElement | null
    if (eventData) {
      if (!scriptJsonLd) {
        scriptJsonLd = document.createElement('script')
        scriptJsonLd.id = 'festflow-schema-jsonld'
        scriptJsonLd.type = 'application/ld+json'
        document.head.appendChild(scriptJsonLd)
      }

      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: eventData.title,
        description: eventData.description || description,
        startDate: eventData.start_date,
        endDate: eventData.end_date || eventData.start_date,
        eventStatus:
          eventData.status === 'cancelled'
            ? 'https://schema.org/EventCancelled'
            : 'https://schema.org/EventScheduled',
        eventAttendanceMode: (eventData as any).location_type === 'online'
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : (eventData as any).location_type === 'hybrid'
          ? 'https://schema.org/MixedEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: eventData.venue_name || 'Campus Venue',
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'IN',
          },
        },
        image: [fullImage],
        organizer: {
          '@type': 'Organization',
          name: eventData.club_name || 'College Organizer',
          url: fullCanonical,
        },
        offers: {
          '@type': 'Offer',
          price: eventData.is_free ? '0' : String(eventData.price || 0),
          priceCurrency: 'INR',
          availability:
            eventData.status === 'published'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
          validFrom: eventData.created_at,
          url: fullCanonical,
        },
      }

      scriptJsonLd.text = JSON.stringify(structuredData)
    } else if (scriptJsonLd) {
      scriptJsonLd.remove()
    }
  }, [title, description, canonicalPath, ogImage, ogType, eventData, noIndex])

  return null
}
