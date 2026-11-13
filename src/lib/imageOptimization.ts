// FestFlow Image Optimization & Compression Utility (Phase 9)

export interface CompressImageOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'image/webp' | 'image/jpeg'
}

/**
 * Compresses an image client-side before network upload.
 * Reduces 5MB-10MB mobile uploads to 200KB-400KB while preserving visual fidelity.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.82,
    format = 'image/webp',
  } = options

  // If file is not an image (e.g. PDF), return original
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      const result = event.target?.result as string
      if (!result) {
        resolve(file)
        return
      }

      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        // Calculate aspect-ratio-preserved bounding box
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }

        // High quality rendering
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // If compressed blob is somehow larger, keep original
              resolve(file)
              return
            }

            const extension = format === 'image/webp' ? '.webp' : '.jpg'
            const newName = file.name.replace(/\.[^/.]+$/, '') + extension
            const compressedFile = new File([blob], newName, {
              type: format,
              lastModified: Date.now(),
            })

            resolve(compressedFile)
          },
          format,
          quality
        )
      }

      img.onerror = () => resolve(file)
      img.src = result
    }

    reader.onerror = () => resolve(file)
    reader.readAsDataURL(file)
  })
}

/**
 * Computes CSS aspect ratio style string to prevent Cumulative Layout Shift (CLS).
 */
export function getAspectRatioStyle(width: number, height: number): React.CSSProperties {
  if (!width || !height) return {}
  return {
    aspectRatio: `${width} / ${height}`,
  }
}

/**
 * Directly reads any file as a standard Data URL without canvas transformations.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve((e.target?.result as string) || '')
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/**
 * Compresses an image client-side directly to a lightweight Base64 Data URL.
 * Produces an ultra-compact (~80KB - 200KB) WebP or JPEG string safe for inline storage.
 */
export async function compressImageToDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 1600,
    maxHeight = 900,
    quality = 0.82,
    format = 'image/webp',
  } = options

  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      const result = event.target?.result as string
      if (!result) {
        resolve('')
        return
      }

      const img = new Image()
      img.onload = () => {
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(result)
          return
        }

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        let dataUrl = ''
        try {
          dataUrl = canvas.toDataURL(format, quality)
        } catch {
          try {
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          } catch {
            dataUrl = result
          }
        }
        resolve(dataUrl || result)
      }

      img.onerror = () => {
        resolve(result)
      }

      img.src = result
    }

    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

/**
 * Optimizes an image URL for mobile delivery:
 * - Detects Unsplash URLs and applies width, format=auto (delivering WebP/AVIF), quality=75
 * - Strips unnecessary resolution bloat on mobile screens
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  targetWidth: number = 800,
  quality: number = 75
): string {
  if (!url) return ''
  // Handle Unsplash images
  if (url.includes('images.unsplash.com')) {
    try {
      const u = new URL(url)
      u.searchParams.set('w', String(targetWidth))
      u.searchParams.set('auto', 'format')
      u.searchParams.set('fit', 'crop')
      u.searchParams.set('q', String(quality))
      return u.toString()
    } catch {
      return url
    }
  }
  return url
}

/**
 * Generates a responsive srcset string for Unsplash event poster images.
 */
export function getImageSrcSet(url: string | null | undefined): string | undefined {
  if (!url || !url.includes('images.unsplash.com')) return undefined
  try {
    const widths = [360, 640, 800, 1080]
    return widths
      .map((w) => `${getOptimizedImageUrl(url, w)} ${w}w`)
      .join(', ')
  } catch {
    return undefined
  }
}

