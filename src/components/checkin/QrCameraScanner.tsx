import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import {
  Camera,
  CameraOff,
  AlertCircle,
  Video,
  Flashlight,
  FlashlightOff,
  Keyboard,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { cleanTicketPayload } from '@/lib/checkin'

interface QrCameraScannerProps {
  onScan: (ticketCode: string) => Promise<void>
  isProcessing: boolean
  onClose?: () => void
  onFocusManual?: () => void
}

export function QrCameraScanner({
  onScan,
  isProcessing,
  onClose,
  onFocusManual,
}: QrCameraScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [hasTorch, setHasTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  const scannerRef = useRef<Html5Qrcode | null>(null)
  const isProcessingRef = useRef(isProcessing)
  isProcessingRef.current = isProcessing

  const lastScannedTokenRef = useRef<{ token: string; timestamp: number } | null>(null)

  // Discover available video input devices
  const discoverCameras = async () => {
    try {
      setCameraError(null)
      setPermissionDenied(false)

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setCameraError('Camera scanning is not supported on this browser or connection (requires HTTPS). Please use manual code entry.')
        return
      }

      const devices = await Html5Qrcode.getCameras()
      if (devices && devices.length > 0) {
        setCameras(devices)
        // Prefer rear camera on mobile if detected in label
        const rear = devices.find((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        )
        setSelectedCameraId(rear ? rear.id : devices[0].id)
      } else {
        setCameraError('No video camera devices found on this device. Please use manual code entry.')
      }
    } catch (err: any) {
      const errStr = (err?.message || String(err)).toLowerCase()
      if (errStr.includes('permission') || errStr.includes('denied')) {
        setPermissionDenied(true)
        setCameraError('Camera access was denied. Please allow camera permissions in your browser address bar.')
      } else {
        setCameraError('Unable to access camera. Please verify device permissions or use manual entry.')
      }
    }
  }

  // Check torch capability after stream starts
  const inspectTorchCapability = () => {
    setTimeout(() => {
      try {
        const videoElem = document.querySelector('#festflow-qr-reader video') as HTMLVideoElement | null
        if (videoElem && videoElem.srcObject) {
          const stream = videoElem.srcObject as MediaStream
          const track = stream.getVideoTracks()[0]
          if (track && track.getCapabilities) {
            const capabilities = track.getCapabilities() as any
            if (capabilities && capabilities.torch) {
              setHasTorch(true)
            }
          }
        }
      } catch {
        // ignore
      }
    }, 600)
  }

  // Toggle flashlight / torch for low light environments
  const toggleTorch = async () => {
    try {
      const videoElem = document.querySelector('#festflow-qr-reader video') as HTMLVideoElement | null
      if (videoElem && videoElem.srcObject) {
        const stream = videoElem.srcObject as MediaStream
        const track = stream.getVideoTracks()[0]
        if (track) {
          const nextState = !torchOn
          await track.applyConstraints({
            advanced: [{ torch: nextState } as any],
          })
          setTorchOn(nextState)
        }
      }
    } catch (err) {
      console.warn('Torch toggle failed:', err)
    }
  }

  // Start the scanner on user action
  const startScanner = async (cameraIdToUse?: string) => {
    try {
      setCameraError(null)
      const targetId = cameraIdToUse || selectedCameraId

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('festflow-qr-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        })
      }

      const config = {
        fps: 15,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
      }

      const cameraParam = targetId ? targetId : { facingMode: 'environment' }

      await scannerRef.current.start(
        cameraParam,
        config,
        async (decodedText: string) => {
          // Prevent repeated triggers while processing
          if (isProcessingRef.current) return

          const clean = cleanTicketPayload(decodedText)
          if (!clean) return

          // Debounce same token within 2 seconds
          const now = Date.now()
          if (
            lastScannedTokenRef.current &&
            lastScannedTokenRef.current.token === clean &&
            now - lastScannedTokenRef.current.timestamp < 2000
          ) {
            return
          }

          lastScannedTokenRef.current = { token: clean, timestamp: now }
          await onScan(clean)
        },
        () => {
          // Frame parse error: ignore standard frame noise
        }
      )

      setIsScanning(true)
      inspectTorchCapability()
    } catch (err: any) {
      setIsScanning(false)
      const errStr = (err?.message || String(err)).toLowerCase()
      if (errStr.includes('permission') || errStr.includes('denied')) {
        setPermissionDenied(true)
        setCameraError('Camera permission was denied. Please permit camera access to scan QR tickets.')
      } else {
        setCameraError('Could not start video stream. Ensure no other application is using the camera, or use manual entry below.')
      }
    }
  }

  // Stop scanner safely
  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch {
        // ignore
      }
    }
    setIsScanning(false)
    setHasTorch(false)
    setTorchOn(false)
  }

  // Unmount / route change cleanup
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch(() => {})
      }
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Viewfinder Card */}
      <div className="relative w-full max-w-sm aspect-square rounded-2xl bg-black border-2 border-[var(--color-surface-3)] overflow-hidden shadow-2xl flex flex-col items-center justify-center">
        {/* HTML5 QR target element */}
        <div id="festflow-qr-reader" className="w-full h-full object-cover" />

        {/* Viewfinder Overlay with Neon Corners when active */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Darkened mask */}
            <div className="relative w-64 h-64 border-2 border-[#18CFFC] rounded-2xl shadow-[0_0_24px_rgba(24,207,252,0.45)]">
              {/* Corner brackets */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br" />

              {/* Animated scanning laser line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#18CFFC] to-transparent animate-pulse absolute top-1/2 -translate-y-1/2" />
            </div>

            {/* Low-light hint at bottom of viewport */}
            <div className="absolute bottom-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white/80 border border-white/10">
              Align QR code in frame
            </div>

            {isProcessing && (
              <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#18CFFC] animate-spin" />
                <span className="text-xs font-semibold text-white tracking-wide">
                  Validating Ticket…
                </span>
              </div>
            )}
          </div>
        )}

        {/* Inactive Standby Screen */}
        {!isScanning && (
          <div className="absolute inset-0 bg-[var(--color-surface-1)] p-6 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] flex items-center justify-center text-[#18CFFC]">
              <Camera size={32} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Camera QR Scanner
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-xs">
                Press start to activate camera. Scan attendee digital passes for instant gate check-in.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={async () => {
                await discoverCameras()
                await startScanner()
              }}
              leftIcon={<Video size={16} />}
              className="mt-2"
            >
              Start Scanner
            </Button>
          </div>
        )}
      </div>

      {/* Error & Permission Alerts */}
      {cameraError && (
        <div className="w-full max-w-sm p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col gap-2 text-left">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <span className="font-semibold block">{permissionDenied ? 'Camera Access Required' : 'Camera Unavailable'}</span>
              <span>{cameraError}</span>
            </div>
          </div>
          {onFocusManual && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={onFocusManual}
                className="text-xs text-[#18CFFC] font-medium hover:underline flex items-center gap-1"
              >
                <Keyboard size={13} /> Switch to manual code lookup
              </button>
            </div>
          )}
        </div>
      )}

      {/* Camera Controls Bar */}
      {isScanning && (
        <div className="w-full max-w-sm flex items-center justify-between gap-2 flex-wrap">
          {/* Torch toggle button (visible when supported on mobile) */}
          {hasTorch && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTorch}
              leftIcon={torchOn ? <FlashlightOff size={14} className="text-amber-400" /> : <Flashlight size={14} />}
              className={`text-xs ${torchOn ? 'border-amber-400 text-amber-300 bg-amber-500/10' : ''}`}
            >
              {torchOn ? 'Torch Off' : 'Torch On'}
            </Button>
          )}

          {/* Camera switcher if multiple cameras */}
          {cameras.length > 1 && (
            <select
              value={selectedCameraId}
              onChange={async (e) => {
                const newId = e.target.value
                setSelectedCameraId(newId)
                await stopScanner()
                await startScanner(newId)
              }}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-surface-3)] text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#18CFFC]"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label || `Camera ${c.id.slice(0, 5)}`}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={stopScanner}
            leftIcon={<CameraOff size={14} />}
            className="text-xs"
          >
            Pause Scanner
          </Button>

          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
