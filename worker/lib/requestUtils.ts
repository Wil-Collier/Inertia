export async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out", { cause: error })
    }
    throw error
  }
}

type ParsedJsonBody =
  | {
    success: true
    body: unknown
  }
  | {
    success: false
    response: Response
  }

function getContentLength(headerValue: string | undefined): number | null {
  if (!headerValue) return null
  const parsed = Number.parseInt(headerValue, 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

// Minimal interface covering only what parseJsonBodyWithLimit needs from a Hono context.
// Using a structural sub-type avoids a generic `any` parameter while keeping this utility
// reusable across all route files regardless of their Bindings/Variables shapes.
interface RequestContext {
  req: {
    header(name: string): string | undefined
    raw: Request
  }
  json(object: unknown, status?: number): Response
}

export async function parseJsonBodyWithLimit(
  c: RequestContext,
  maxBytes: number,
  sizeLimitMessage: string
): Promise<ParsedJsonBody> {
  const contentLength = getContentLength(c.req.header("Content-Length"))
  if (contentLength !== null && contentLength > maxBytes) {
    return {
      success: false,
      response: c.json({ error: "PAYLOAD_TOO_LARGE", message: sizeLimitMessage }, 413),
    }
  }

  let bodyBytes: ArrayBuffer
  try {
    bodyBytes = await c.req.raw.arrayBuffer()
  } catch {
    return {
      success: false,
      response: c.json({ error: "INVALID_REQUEST", message: "Invalid JSON payload" }, 400),
    }
  }

  if (bodyBytes.byteLength > maxBytes) {
    return {
      success: false,
      response: c.json({ error: "PAYLOAD_TOO_LARGE", message: sizeLimitMessage }, 413),
    }
  }

  let parsedBody: unknown
  try {
    const textBody = new TextDecoder().decode(bodyBytes)
    parsedBody = JSON.parse(textBody)
  } catch {
    return {
      success: false,
      response: c.json({ error: "INVALID_REQUEST", message: "Invalid JSON payload" }, 400),
    }
  }

  return {
    success: true,
    body: parsedBody,
  }
}
