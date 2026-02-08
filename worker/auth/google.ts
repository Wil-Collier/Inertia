export interface VerifiedGoogleToken {
  sub: string
  email: string
}

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
const JWKS_REQUEST_TIMEOUT_MS = 5000
const DEFAULT_JWKS_TTL_SECONDS = 300

type GoogleJwk = {
  kty: string
  kid: string
  n: string
  e: string
  alg?: string
  use?: string
  [key: string]: unknown
}

let jwksCache: { keys: Map<string, GoogleJwk>; expiresAtMs: number } | null = null

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<VerifiedGoogleToken> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".")
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("INVALID_TOKEN")
  }

  const header = parseJwtJsonSegment(encodedHeader)
  const payload = parseJwtJsonSegment(encodedPayload)
  if (!isRecord(header) || !isRecord(payload)) {
    throw new Error("INVALID_TOKEN")
  }

  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length === 0) {
    throw new Error("INVALID_TOKEN")
  }

  let signingKeys = await getGoogleSigningKeys(false)
  let signingKey = signingKeys.get(header.kid)
  if (!signingKey) {
    signingKeys = await getGoogleSigningKeys(true)
    signingKey = signingKeys.get(header.kid)
  }
  if (!signingKey) {
    throw new Error("INVALID_TOKEN")
  }

  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const signatureBytes = decodeBase64Url(encodedSignature)
  const cryptoKey = await importGoogleJwk(signingKey)
  const isValidSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signatureBytes, signingInput)
  if (!isValidSignature) {
    throw new Error("INVALID_TOKEN")
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === "number" ? payload.exp : null
  if (!exp || exp <= nowSeconds) {
    throw new Error("INVALID_TOKEN")
  }

  const nbf = typeof payload.nbf === "number" ? payload.nbf : null
  if (nbf !== null && nbf > nowSeconds) {
    throw new Error("INVALID_TOKEN")
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null
  if (!sub) {
    throw new Error("INVALID_TOKEN")
  }

  if (!matchesAudience(payload.aud, clientId)) {
    throw new Error("FORBIDDEN")
  }

  const issuer = typeof payload.iss === "string" ? payload.iss : null
  if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
    throw new Error("FORBIDDEN")
  }

  const verified = payload.email_verified === true || payload.email_verified === "true"
  if (!verified) {
    throw new Error("FORBIDDEN")
  }

  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : "",
  }
}

async function getGoogleSigningKeys(forceRefresh: boolean): Promise<Map<string, GoogleJwk>> {
  const now = Date.now()
  if (!forceRefresh && jwksCache && jwksCache.expiresAtMs > now) {
    return jwksCache.keys
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), JWKS_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(GOOGLE_JWKS_URL, { signal: controller.signal })
  } catch {
    throw new Error("SERVER_ERROR")
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new Error("SERVER_ERROR")
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error("SERVER_ERROR")
  }

  if (!isRecord(body) || !Array.isArray(body.keys)) {
    throw new Error("SERVER_ERROR")
  }

  const keys = body.keys.filter(toGoogleJwk)

  const keyMap = new Map<string, GoogleJwk>()
  keys.forEach((key) => {
    keyMap.set(key.kid, key)
  })

  const maxAgeSeconds = getCacheMaxAgeSeconds(response.headers.get("Cache-Control")) ?? DEFAULT_JWKS_TTL_SECONDS
  jwksCache = {
    keys: keyMap,
    expiresAtMs: now + maxAgeSeconds * 1000,
  }

  return keyMap
}

function getCacheMaxAgeSeconds(cacheControl: string | null): number | null {
  if (!cacheControl) return null
  const match = /max-age=(\d+)/i.exec(cacheControl)
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function parseJwtJsonSegment(segment: string): unknown {
  try {
    const json = new TextDecoder().decode(decodeBase64Url(segment))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function matchesAudience(value: unknown, clientId: string): boolean {
  if (typeof value === "string") {
    return value === clientId
  }
  if (Array.isArray(value)) {
    return value.some((entry) => entry === clientId)
  }
  return false
}

function toGoogleJwk(value: unknown): value is GoogleJwk {
  if (!isRecord(value)) return false
  return (
    typeof value.kid === "string" &&
    typeof value.kty === "string" &&
    typeof value.n === "string" &&
    typeof value.e === "string"
  )
}

async function importGoogleJwk(jwk: GoogleJwk): Promise<CryptoKey> {
  try {
    const importableKey: JsonWebKey = {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
      ...(jwk.alg ? { alg: jwk.alg } : {}),
      ...(jwk.use ? { use: jwk.use } : {}),
    }

    return await crypto.subtle.importKey(
      "jwk",
      importableKey,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["verify"]
    )
  } catch {
    throw new Error("INVALID_TOKEN")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
