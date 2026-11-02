import { useState, useEffect } from 'react'
import { Image as ImageIcon, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import type { EventGalleryImage } from '@/types'

interface EventGallerySectionProps {
  images: EventGalleryImage[]
}

export function EventGallerySection({ images }: EventGallerySectionProps) {
  const [activeLightboxIndex, setActiveLightboxIndex] = useState<number | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeLightboxIndex === null) return
      if (e.key === 'Escape') setActiveLightboxIndex(null)
      if (e.key === 'ArrowRight') {
        setActiveLightboxIndex((prev) =>
          prev !== null ? (prev + 1) % images.length : null
        )
      }
      if (e.key === 'ArrowLeft') {
        setActiveLightboxIndex((prev) =>
          prev !== null ? (prev - 1 + images.length) % images.length : null
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeLightboxIndex, images.length])

  if (!images || images.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <ImageIcon size={18} className="text-[#ED47FC]" />
            Moments & Fest Highlights
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Photographs from previous editions and live campus memories
          </p>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          {images.length} photo{images.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Responsive Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, idx) => (
          <div
            key={img.id || idx}
            onClick={() => setActiveLightboxIndex(idx)}
            className="group relative aspect-video sm:aspect-square rounded-2xl overflow-hidden bg-[#14141A] border border-white/[0.08] hover:border-[#18CFFC]/50 cursor-pointer transition-all duration-300 shadow-sm"
          >
            <img
              src={img.image_url}
              alt={img.caption || `Fest moment ${idx + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
              {img.caption && (
                <span className="text-[11px] font-medium text-white line-clamp-1">
                  {img.caption}
                </span>
              )}
              <div className="flex items-center gap-1 text-[10px] text-[#18CFFC]">
                <Maximize2 size={10} /> Tap to expand
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Fullscreen Lightbox Modal ────────────────────────────────────── */}
      {activeLightboxIndex !== null && images[activeLightboxIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
          <button
            type="button"
            onClick={() => setActiveLightboxIndex(null)}
            className="absolute top-4 right-4 z-10 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close photo preview"
          >
            <X size={20} />
          </button>

          {/* Navigation Controls */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveLightboxIndex(
                    (activeLightboxIndex - 1 + images.length) % images.length
                  )
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Previous photo"
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveLightboxIndex((activeLightboxIndex + 1) % images.length)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Next photo"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Lightbox Content */}
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3">
            <img
              src={images[activeLightboxIndex].image_url}
              alt={images[activeLightboxIndex].caption || 'Fest moment preview'}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <div className="flex items-center justify-between w-full text-xs text-zinc-300 px-2">
              <span>{images[activeLightboxIndex].caption || 'Fest Highlight'}</span>
              <span className="font-mono text-zinc-500">
                {activeLightboxIndex + 1} of {images.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

