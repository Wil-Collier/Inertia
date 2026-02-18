import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { QuaggaJSResultCallbackFunction, QuaggaJSConfigObject } from "@ericblade/quagga2"
import { BarcodeScanner, getAverageDecodeError } from "@/components/BarcodeScanner"

const mockInit = vi.fn()
const mockStart = vi.fn()
const mockStop = vi.fn()
const mockOnDetected = vi.fn()
const mockOffDetected = vi.fn()

const quaggaState = vi.hoisted(() => ({
  initConfig: null as QuaggaJSConfigObject | null,
  detectedCallback: null as QuaggaJSResultCallbackFunction | null,
  nextInitError: null as Error | null,
  started: false,
}))

vi.mock("@ericblade/quagga2", () => {
  return {
    default: {
      init: (...args: Parameters<typeof mockInit>) => mockInit(...args),
      start: (...args: Parameters<typeof mockStart>) => mockStart(...args),
      stop: (...args: Parameters<typeof mockStop>) => mockStop(...args),
      onDetected: (...args: Parameters<typeof mockOnDetected>) => mockOnDetected(...args),
      offDetected: (...args: Parameters<typeof mockOffDetected>) => mockOffDetected(...args),
    },
  }
})

// Wire up mock implementations after vi.mock
mockInit.mockImplementation(async (config: QuaggaJSConfigObject) => {
  quaggaState.initConfig = config
  if (quaggaState.nextInitError) {
    throw quaggaState.nextInitError
  }
})
mockStart.mockImplementation(() => {
  quaggaState.started = true
})
mockStop.mockImplementation(async () => {
  quaggaState.started = false
})
mockOnDetected.mockImplementation((cb: QuaggaJSResultCallbackFunction) => {
  quaggaState.detectedCallback = cb
})
mockOffDetected.mockImplementation(() => {
  quaggaState.detectedCallback = null
})

function makeScanResult(code: string, errorRate = 0.05): Parameters<QuaggaJSResultCallbackFunction>[0] {
  return {
    codeResult: {
      code,
      start: 0,
      end: 0,
      codeset: 0,
      startInfo: { error: 0, code: 0, start: 0, end: 0 },
      decodedCodes: [
        { error: errorRate, code: 1, start: 0, end: 10 },
        { error: errorRate, code: 2, start: 10, end: 20 },
        { error: errorRate, code: 3, start: 20, end: 30 },
      ],
      endInfo: { error: 0, code: 0, start: 0, end: 0 },
      direction: 1,
      format: "ean_13",
    },
    line: [],
    angle: 0,
    pattern: [],
    box: [],
    boxes: [],
  }
}

/** Emit N consecutive detections of the same code (default low error) */
function emitDetections(code: string, count: number, errorRate = 0.05) {
  for (let i = 0; i < count; i++) {
    quaggaState.detectedCallback!(makeScanResult(code, errorRate))
  }
}

describe("getAverageDecodeError", () => {
  it("returns average of segment errors", () => {
    const result = makeScanResult("123", 0.08)
    expect(getAverageDecodeError(result)).toBeCloseTo(0.08)
  })

  it("returns 0 when no error info is present", () => {
    const result = makeScanResult("123")
    result.codeResult.decodedCodes = [
      { code: 1, start: 0, end: 10 },
    ]
    expect(getAverageDecodeError(result)).toBe(0)
  })
})

describe("BarcodeScanner", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    quaggaState.initConfig = null
    quaggaState.detectedCallback = null
    quaggaState.nextInitError = null
    quaggaState.started = false

    // Re-wire implementations after clearAllMocks
    mockInit.mockImplementation(async (config: QuaggaJSConfigObject) => {
      quaggaState.initConfig = config
      if (quaggaState.nextInitError) {
        throw quaggaState.nextInitError
      }
    })
    mockStart.mockImplementation(() => {
      quaggaState.started = true
    })
    mockStop.mockImplementation(async () => {
      quaggaState.started = false
    })
    mockOnDetected.mockImplementation((cb: QuaggaJSResultCallbackFunction) => {
      quaggaState.detectedCallback = cb
    })
    mockOffDetected.mockImplementation(() => {
      quaggaState.detectedCallback = null
    })
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

  it("accepts after 3 consecutive confirmed reads", async () => {
    const onScan = vi.fn()

    render(
      <BarcodeScanner
        isOpen={true}
        onClose={vi.fn()}
        onScan={onScan}
      />
    )

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1)
      expect(mockStart).toHaveBeenCalledTimes(1)
      expect(mockOnDetected).toHaveBeenCalledTimes(1)
    })

    expect(quaggaState.initConfig).toMatchObject({
      locator: { patchSize: "medium", halfSample: true },
      frequency: 15,
      locate: true,
    })

    // First read: not enough to confirm
    expect(quaggaState.detectedCallback).not.toBeNull()
    emitDetections("0123456789", 1)
    expect(onScan).not.toHaveBeenCalled()

    // Second read: confirmation threshold reached
    emitDetections("0123456789", 1)

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalledTimes(1)
      expect(onScan).toHaveBeenCalledWith("0123456789")
    })

    // Further detections ignored after acceptance
    if (quaggaState.detectedCallback) {
      emitDetections("0000000000", 3)
    }
    await waitFor(() => {
      expect(onScan).toHaveBeenCalledTimes(1)
    })
  })

  it("rejects high-error detections", async () => {
    const onScan = vi.fn()

    render(
      <BarcodeScanner
        isOpen={true}
        onClose={vi.fn()}
        onScan={onScan}
      />
    )

    await waitFor(() => {
      expect(mockOnDetected).toHaveBeenCalledTimes(1)
    })

    // Send 5 detections with high error -- all should be ignored
    emitDetections("9999999999", 5, 0.5)
    expect(onScan).not.toHaveBeenCalled()
    expect(mockStop).not.toHaveBeenCalled()
  })

  it("resets confirmation streak when a different code is read", async () => {
    const onScan = vi.fn()

    render(
      <BarcodeScanner
        isOpen={true}
        onClose={vi.fn()}
        onScan={onScan}
      />
    )

    await waitFor(() => {
      expect(mockOnDetected).toHaveBeenCalledTimes(1)
    })

    // 1 read of code A, then 1 read of code B resets the streak
    emitDetections("1111111111", 1)
    emitDetections("2222222222", 1)
    expect(onScan).not.toHaveBeenCalled()

    // 1 more read of code B reaches 2 total for B
    emitDetections("2222222222", 1)

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith("2222222222")
    })
  })

  it("shows permission error state and closes scanner safely", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    quaggaState.nextInitError = new Error("NotAllowedError")

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

    // Scanner should not have started
    expect(mockStart).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Close scanner" }))

    expect(onClose).toHaveBeenCalledTimes(1)
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
      expect(mockStart).toHaveBeenCalledTimes(1)
    })

    rerender(
      <BarcodeScanner
        isOpen={false}
        onClose={vi.fn()}
        onScan={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockStop).toHaveBeenCalledTimes(1)
    })
  })
})
