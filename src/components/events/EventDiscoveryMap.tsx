import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Link } from 'react-router'
import {
  MapPin,
  Calendar,
  Compass,
  ArrowRight,
  Globe,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Building2,
} from 'lucide-react'
import { CategoryBadge, Button } from '@/components/ui'
import { EventStatusBadge } from './EventStatusBadge'
import type { Event } from '@/types'

// Known campus and regional hubs for automatic geocoding fallback
const CAMPUS_GEO_COORDINATES: Record<string, { lat: number; lng: number; campusName: string }> = {
  anurag: { lat: 17.4200, lng: 78.6560, campusName: 'Anurag University Campus' },
  jntu: { lat: 17.4930, lng: 78.3910, campusName: 'JNTU Campus' },
  ou: { lat: 17.4190, lng: 78.5270, campusName: 'Osmania University Campus' },
  hcu: { lat: 17.4560, lng: 78.3300, campusName: 'University of Hyderabad' },
  bits: { lat: 17.5449, lng: 78.5718, campusName: 'BITS Pilani Hyderabad' },
  iit: { lat: 17.5947, lng: 78.1230, campusName: 'IIT Hyderabad Campus' },
  cbit: { lat: 17.3917, lng: 78.3197, campusName: 'CBIT Gandipet' },
  vnr: { lat: 17.5385, lng: 78.3846, campusName: 'VNR VJIET Campus' },
}

// Bounding box for normalized 2D map projection
const MAP_BOUNDS = {
  minLat: 17.3000,
  maxLat: 17.6500,
  minLng: 78.1000,
  maxLng: 78.7500,
}

interface GeocodedEvent {
  event: Event
  x: number // 0% to 100%
  y: number // 0% to 100%
  campusLabel: string
}

function resolveCoordinates(event: Event): { lat: number; lng: number; campusLabel: string } | null {
  // 1. Explicit latitude & longitude if present
  if (typeof event.latitude === 'number' && typeof event.longitude === 'number') {
    return { lat: event.latitude, lng: event.longitude, campusLabel: event.venue || 'Campus Venue' }
  }

  // 2. Derive from venue or address text
  const searchStr = `${event.venue || ''} ${event.location || ''} ${event.venueAddress || ''}`.toLowerCase()

  for (const [key, hub] of Object.entries(CAMPUS_GEO_COORDINATES)) {
    if (searchStr.includes(key)) {
      return { lat: hub.lat, lng: hub.lng, campusLabel: hub.campusName }
    }
  }

  // 3. Default Anurag / Hyderabad central campus fallback for physical events with a venue
  if (event.venue && event.eventType !== 'online') {
    // Deterministic pseudo-offset based on event slug so markers don't overlap completely
    const hash = event.slug.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const latOffset = ((hash % 10) - 5) * 0.015
    const lngOffset = (((hash >> 2) % 10) - 5) * 0.02
    return {
      lat: CAMPUS_GEO_COORDINATES.anurag.lat + latOffset,
      lng: CAMPUS_GEO_COORDINATES.anurag.lng + lngOffset,
      campusLabel: event.venue,
    }
  }

  return null
}

interface EventDiscoveryMapProps {
  events: Event[]
  className?: string
}

export function EventDiscoveryMap({ events, className = '' }: EventDiscoveryMapProps) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showOnlineDrawer, setShowOnlineDrawer] = useState<boolean>(false)
  const [zoomLevel, setZoomLevel] = useState<number>(1)

  // Partition events into physical geocoded events and online events
  const { physicalEvents, onlineEvents } = useMemo(() => {
    const physical: GeocodedEvent[] = []
    const online: Event[] = []

    events.forEach((evt) => {
      if (evt.eventType === 'online') {
        online.push(evt)
        return
      }

      const coords = resolveCoordinates(evt)
      if (!coords) {
        online.push(evt)
        return
      }

      // Project into 0-100% SVG coordinates
      const x = Math.min(
        Math.max(((coords.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100, 5),
        95
      )
      const y = Math.min(
        Math.max(((MAP_BOUNDS.maxLat - coords.lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100, 5),
        95
      )

      physical.push({
        event: evt,
        x,
        y,
        campusLabel: coords.campusLabel,
      })
    })

    return { physicalEvents: physical, onlineEvents: online }
  }, [events])

  // Filter physical events by category
  const filteredPhysical = useMemo(() => {
    if (selectedCategory === 'all') return physicalEvents
    return physicalEvents.filter((item) => item.event.category === selectedCategory)
  }, [physicalEvents, selectedCategory])

  const selectedItem = useMemo(() => {
    if (!selectedEventId) return null
    return (
      physicalEvents.find((p) => p.event.id === selectedEventId) ||
      onlineEvents.find((e) => e.id === selectedEventId)
    )
  }, [selectedEventId, physicalEvents, onlineEvents])

  const selectedEvent = selectedItem
    ? 'event' in selectedItem
      ? selectedItem.event
      : (selectedItem as Event)
    : null

  return (
    <div className={`relative flex flex-col rounded-3xl border border-white/[0.08] bg-[#08080A] overflow-hidden shadow-2xl ${className}`}>
      {/* ── Top Map Controls & Category Filter ───────────────────────────── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 bg-gradient-to-b from-[#0E0E12]/95 to-[#0E0E12]/80 backdrop-blur-md border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] flex items-center justify-center text-white shadow-md">
            <Compass size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white font-display flex items-center gap-1.5">
              Campus Event Radar
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h3>
            <span className="text-[11px] text-zinc-400">
              {filteredPhysical.length} campus venues plotted
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['all', 'tech', 'cultural', 'sports', 'workshop', 'hackathon'].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer capitalize ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-[#18CFFC] to-[#7F1AFB] text-white shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5'
              }`}
            >
              {cat}
            </button>
          ))}

          {onlineEvents.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOnlineDrawer(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#18CFFC]/10 hover:bg-[#18CFFC]/20 text-[#18CFFC] border border-[#18CFFC]/30 transition-all cursor-pointer"
            >
              <Globe size={11} /> Virtual Events ({onlineEvents.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Interactive Radar Canvas ──────────────────────────────────────── */}
      <div className="relative w-full h-[420px] sm:h-[480px] bg-[#08080A] overflow-hidden select-none">
        {/* Subtle Radar Background Grid & Rings */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(24, 207, 252, 0.15) 0%, transparent 60%),
                              linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        />

        {/* Radar concentric sweep rings */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] rounded-full border border-[#18CFFC]/15 pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] rounded-full border border-[#7F1AFB]/20 pointer-events-none"
        />

        {/* Map Zoom Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-[#0E0E12]/90 border border-white/10 rounded-xl p-1 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 1.75))}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.75))}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            onClick={() => { setZoomLevel(1); setSelectedEventId(null) }}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Reset View"
            aria-label="Reset map"
          >
            <Maximize2 size={15} />
          </button>
        </div>

        {/* Plotted Interactive Pins Container */}
        <div
          className="absolute inset-0 transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
        >
          {filteredPhysical.map(({ event: evt, x, y }) => {
            const isSelected = evt.id === selectedEventId

            return (
              <div
                key={evt.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer group"
                onClick={() => setSelectedEventId(evt.id)}
              >
                {/* Glowing Radar Pulse on Pin */}
                <div
                  className={`absolute -inset-3 rounded-full transition-opacity duration-300 pointer-events-none ${
                    isSelected ? 'opacity-100 animate-ping bg-[#18CFFC]/30' : 'opacity-0 group-hover:opacity-60 bg-[#7F1AFB]/20'
                  }`}
                />

                {/* Marker Pin */}
                <div
                  className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 shadow-xl ${
                    isSelected
                      ? 'w-10 h-10 bg-gradient-to-br from-[#18CFFC] to-[#7F1AFB] text-white scale-125 ring-4 ring-[#18CFFC]/30'
                      : 'w-8 h-8 bg-[#14141A] border border-white/20 text-[#18CFFC] group-hover:scale-110 group-hover:border-[#18CFFC]'
                  }`}
                >
                  <MapPin size={isSelected ? 18 : 15} />
                </div>

                {/* Hover Label */}
                <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 rounded-md bg-[#0E0E12]/95 border border-white/15 text-[10px] font-semibold text-white whitespace-nowrap shadow-md pointer-events-none transition-opacity duration-150 ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <span className="text-[#18CFFC] mr-1">•</span>
                  {evt.title}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Selected Event Preview Floating Card ────────────────────────── */}
        <AnimatePresence>
          {selectedEvent && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-30 p-4 rounded-2xl bg-[#0E0E12]/95 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_24px_rgba(24,207,252,0.15)] backdrop-blur-xl text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-1.5 flex-wrap items-center mb-1">
                  <CategoryBadge category={selectedEvent.category} />
                  <EventStatusBadge event={selectedEvent} />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEventId(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close preview"
                >
                  <X size={16} />
                </button>
              </div>

              <h4 className="text-base font-bold text-white font-display line-clamp-1 mt-1">
                {selectedEvent.title}
              </h4>

              <div className="flex flex-col gap-1 text-xs text-zinc-400 mt-2">
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 size={12} className="text-[#18CFFC] shrink-0" />
                  <span className="truncate">{selectedEvent.clubName}</span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin size={12} className="text-zinc-500 shrink-0" />
                  <span className="truncate">{selectedEvent.venue || selectedEvent.location}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={12} className="text-[#ED47FC] shrink-0" />
                  <span>
                    {selectedEvent.date ? new Date(selectedEvent.date).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }) : 'Date TBA'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
                <span className="text-xs font-bold text-white">
                  {selectedEvent.isFree ? (
                    <span className="text-emerald-400 font-bold">FREE ENTRY</span>
                  ) : (
                    <span>₹{selectedEvent.price}</span>
                  )}
                </span>
                <Link to={`/events/${selectedEvent.slug}`}>
                  <Button size="sm" variant="primary" rightIcon={<ArrowRight size={13} />}>
                    View Event Details
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Virtual & Online Events Drawer / Modal ───────────────────────── */}
      <AnimatePresence>
        {showOnlineDrawer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 bg-[#0E0E12] border-t border-white/10 text-left flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-[#18CFFC]" />
                <h4 className="text-sm font-bold text-white font-display">
                  Virtual & Online Campus Events ({onlineEvents.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowOnlineDrawer(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {onlineEvents.map((evt) => (
                <Link
                  key={evt.id}
                  to={`/events/${evt.slug}`}
                  className="p-3 rounded-xl bg-[#14141A] hover:bg-[#1A1A22] border border-white/10 transition-all flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <CategoryBadge category={evt.category} />
                    <span className="text-[10px] font-bold text-emerald-400">ONLINE</span>
                  </div>
                  <h5 className="text-xs font-bold text-white line-clamp-1">{evt.title}</h5>
                  <span className="text-[11px] text-zinc-400 truncate">{evt.clubName}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
