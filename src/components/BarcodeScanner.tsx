import { useEffect, useRef, useState, useCallback } from "react"
import Quagga from "@ericblade/quagga2"
import type { QuaggaJSResultObject } from "@ericblade/quagga2"
import { X, Camera, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const CAMERA_DISABLED = import.meta.env.VITE_E2E_DISABLE_CAMERA === "true"

// Reject detections where average decode error exceeds this threshold.
// Lower = stricter. Quagga error values are typically 0-1, with good reads < 0.1.
const MAX_AVG_ERROR = 0.15

// Require the same barcode to be read this many consecutive times before accepting.
// Eliminates one-off misreads while keeping response time snappy at 10 fps.
const CONFIRMATION_READS = 3

/**
 * Compute average error across decoded segments that have an error value.
 * Returns 0 when no error info is available (e.g. in tests), which passes the filter.
 */
export function getAverageDecodeError(result: QuaggaJSResultObject): number {
  const errors = result.codeResult.decodedCodes
    .map((c) => c.error)
    .filter((e): e is number => typeof e === "number")
  if (errors.length === 0) return 0
  return errors.reduce((sum, e) => sum + e, 0) / errors.length
}

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [manualBarcode, setManualBarcode] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const onScanRef = useRef(onScan)
  const activeRef = useRef(false)

  // Keep the callback ref updated without causing re-renders
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const stopScanner = useCallback(async () => {
    if (activeRef.current) {
      activeRef.current = false
      try {
        await Quagga.stop()
      } catch {
        // Ignore errors when stopping (may already be stopped)
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    if (CAMERA_DISABLED) {
      setIsStarting(false)
      setError(null)
      return
    }

    let mounted = true

    const startScanner = async () => {
      setIsStarting(true)
      setError(null)

      // Small delay to ensure DOM is ready
      await new Promise((resolve) => setTimeout(resolve, 100))

      if (!mounted || !containerRef.current) return

      try {
        await Quagga.init({
          inputStream: {
            type: "LiveStream",
            target: containerRef.current,
            constraints: {
              facingMode: "environment",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          frequency: 10,
          numOfWorkers: 0,
          locate: true,
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "upc_reader",
              "upc_e_reader",
              "code_128_reader",
            ],
          },
        })

        if (!mounted) {
          await Quagga.stop()
          return
        }

        // Confirmation buffer: track consecutive reads of the same code
        let lastCode: string | null = null
        let streak = 0

        const onDetected = (result: QuaggaJSResultObject) => {
          const code = result.codeResult.code
          if (!code || !mounted || !activeRef.current) return

          // Reject high-error detections (likely misreads)
          const avgError = getAverageDecodeError(result)
          if (avgError > MAX_AVG_ERROR) return

          // Require CONFIRMATION_READS consecutive matching reads
          if (code === lastCode) {
            streak++
          } else {
            lastCode = code
            streak = 1
          }
          if (streak < CONFIRMATION_READS) return

          // Confirmed -- stop scanner before calling onScan to prevent multiple scans
          activeRef.current = false
          Quagga.offDetected(onDetected)
          void (async () => {
            try {
              await Quagga.stop()
            } catch {
              // Ignore
            }
            onScanRef.current(code)
          })()
        }

        Quagga.onDetected(onDetected)
        activeRef.current = true
        Quagga.start()

        if (mounted) {
          setIsStarting(false)
        }
      } catch (err) {
        if (!mounted) return

        setIsStarting(false)
        const errorMessage = err instanceof Error ? err.message : String(err)

        if (
          errorMessage.includes("Permission") ||
          errorMessage.includes("NotAllowed")
        ) {
          setError("Camera access denied. Please allow camera access to scan barcodes.")
        } else if (
          errorMessage.includes("NotFound") ||
          errorMessage.includes("no camera")
        ) {
          setError("No camera found on this device.")
        } else {
          setError(`Failed to start camera: ${errorMessage}`)
        }
      }
    }

    void startScanner()

    return () => {
      mounted = false
      void stopScanner()
    }
  }, [isOpen, stopScanner])

  const handleClose = async () => {
    await stopScanner()
    onClose()
  }

  const handleManualSubmit = () => {
    const trimmed = manualBarcode.trim()
    if (!trimmed) return
    onScanRef.current(trimmed)
    setManualBarcode("")
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col safe-area-top">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-semibold">Scan Barcode</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleClose()}
          aria-label="Close scanner"
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center px-8">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-white">{error}</p>
            <Button variant="secondary" onClick={() => void handleClose()}>
              Close
            </Button>
          </div>
        ) : (
          <>
            {isStarting && (
              <div className="flex flex-col items-center gap-4 text-white absolute z-10">
                <Camera className="h-12 w-12 animate-pulse" />
                <p>Starting camera...</p>
              </div>
            )}
            <div
              ref={containerRef}
              className="w-full max-w-sm rounded-lg overflow-hidden [&>video]:w-full [&>canvas]:absolute [&>canvas]:top-0 [&>canvas]:left-0"
            />
            <p className="text-white/80 text-sm mt-4 text-center px-8">
              Point your camera at a barcode on a food product
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 safe-area-bottom space-y-3">
        <div className="space-y-2">
          <p className="text-xs text-white/80 uppercase tracking-widest">Manual Entry</p>
          <div className="flex gap-2">
            <Input
              data-testid="manual-barcode-input"
              value={manualBarcode}
              onChange={(event) => setManualBarcode(event.target.value)}
              placeholder="Enter barcode manually"
              inputMode="numeric"
              className="bg-white text-black"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleManualSubmit()
                }
              }}
            />
            <Button
              data-testid="manual-barcode-submit"
              variant="secondary"
              className="shrink-0"
              onClick={handleManualSubmit}
              disabled={!manualBarcode.trim()}
            >
              Use Barcode
            </Button>
          </div>
        </div>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void handleClose()}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
