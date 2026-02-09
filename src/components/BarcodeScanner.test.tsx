import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BarcodeScanner } from "@/components/BarcodeScanner"

interface MockScannerInstance {
  containerId: string
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
}

function isScanSuccessCallback(value: unknown): value is (decodedText: string) => void {
  return typeof value === "function"
}

const scannerState = vi.hoisted(() => ({
  instances: [] as MockScannerInstance[],
  nextStartError: null as Error | null,
}))

vi.mock("html5-qrcode", () => {
  class MockHtml5Qrcode {
    containerId: string
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>

    constructor(containerId: string) {
      this.containerId = containerId
      this.start = vi.fn(async (_camera, _config, _onSuccess) => {
        if (scannerState.nextStartError) {
          throw scannerState.nextStartError
        }
      })
      this.stop = vi.fn(async () => {})
      scannerState.instances.push(this)
    }
  }

  return { Html5Qrcode: MockHtml5Qrcode }
})

describe("BarcodeScanner", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    scannerState.instances = []
    scannerState.nextStartError = null
  })

  it("does not render when closed", () => {
    render(
      <BarcodeScanner
        isOpen={false}
        onClose={vi.fn()}
        onScan={vi.fn()}
      />
    )

    expect(screen.queryByText("Scan Barcode")).toBeNull()
  })

  it("starts scanner with expected config and handles a single scan callback", async () => {
    const onScan = vi.fn()

    render(
      <BarcodeScanner
        isOpen={true}
        onClose={vi.fn()}
        onScan={onScan}
      />
    )

    await waitFor(() => {
      expect(scannerState.instances.length).toBe(1)
      expect(scannerState.instances[0]?.start).toHaveBeenCalledTimes(1)
    })

    const scanner = scannerState.instances[0]
    const call = scanner.start.mock.calls[0]
    expect(call?.[0]).toEqual({ facingMode: "environment" })
    expect(call?.[1]).toMatchObject({
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0,
    })

    const onSuccess = call?.[2]
    expect(isScanSuccessCallback(onSuccess)).toBe(true)
    if (!isScanSuccessCallback(onSuccess)) {
      throw new Error("Expected scanner start callback")
    }
    onSuccess("0123456789")

    await waitFor(() => {
      expect(scanner.stop).toHaveBeenCalledTimes(1)
      expect(onScan).toHaveBeenCalledWith("0123456789")
    })

    onSuccess("0000000000")
    await waitFor(() => {
      expect(onScan).toHaveBeenCalledTimes(1)
    })
  })

  it("shows permission error state and closes scanner safely", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    scannerState.nextStartError = new Error("NotAllowedError")

    render(
      <BarcodeScanner
        isOpen={true}
        onClose={onClose}
        onScan={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(screen.getByText("Camera access denied. Please allow camera access to scan barcodes.")).toBeTruthy()
    })
    await user.click(screen.getByRole("button", { name: "Close" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(scannerState.instances[0]?.stop).toHaveBeenCalledTimes(1)
  })

  it("stops scanner on close/unmount transitions", async () => {
    const { rerender } = render(
      <BarcodeScanner
        isOpen={true}
        onClose={vi.fn()}
        onScan={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(scannerState.instances[0]?.start).toHaveBeenCalledTimes(1)
    })

    rerender(
      <BarcodeScanner
        isOpen={false}
        onClose={vi.fn()}
        onScan={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(scannerState.instances[0]?.stop).toHaveBeenCalledTimes(1)
    })
  })
})
