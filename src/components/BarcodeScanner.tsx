import { useEffect, useRef, useState } from "react"
import { Html5Qrcode } from "html5-qrcode"
import { X, Camera, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
}

export function BarcodeScanner({ isOpen, onClose, onScan }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const scannerId = "barcode-scanner-container"
    let mounted = true

    const startScanner = async () => {
      setIsStarting(true)
      setError(null)

      try {
        const scanner = new Html5Qrcode(scannerId)
        scannerRef.current = scanner

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
          formatsToSupport: [
            0,  // QR_CODE
            1,  // AZTEC
            2,  // CODABAR
            3,  // CODE_39
            4,  // CODE_93
            5,  // CODE_128
            6,  // DATA_MATRIX
            7,  // MAXICODE
            8,  // ITF
            9,  // EAN_13
            10, // EAN_8
            11, // PDF_417
            12, // RSS_14
            13, // RSS_EXPANDED
            14, // UPC_A
            15, // UPC_E
            16, // UPC_EAN_EXTENSION
          ],
        }

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if (mounted) {
              // Stop scanner before calling onScan to prevent multiple scans
              scanner.stop().catch(console.error)
              onScan(decodedText)
            }
          },
          () => {
            // Ignore scan failures (no barcode detected yet)
          }
        )

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

    startScanner()

    return () => {
      mounted = false
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {
          // Ignore errors when stopping (may already be stopped)
        })
        scannerRef.current = null
      }
    }
  }, [isOpen, onScan])

  const handleClose = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {})
      scannerRef.current = null
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-semibold">Scan Barcode</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
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
            <Button variant="secondary" onClick={handleClose}>
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
              id="barcode-scanner-container"
              ref={containerRef}
              className="w-full max-w-sm rounded-lg overflow-hidden"
            />
            <p className="text-white/80 text-sm mt-4 text-center px-8">
              Point your camera at a barcode on a food product
            </p>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 safe-area-bottom">
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
