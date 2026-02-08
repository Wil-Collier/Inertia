import { afterEach, describe, expect, it, vi } from "vitest"
import { verifyGoogleIdToken } from "./google"

type JwtPayloadInput = {
  sub?: string
  email?: string
  aud?: string | string[]
  iss?: string
  email_verified?: boolean | string
  exp?: number
  nbf?: number
}

type TestGoogleJwk = {
  kty: string
  kid: string
  n: string
  e: string
  alg?: string
  use?: string
  [key: string]: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isCryptoKeyPair(value: CryptoKey | CryptoKeyPair): value is CryptoKeyPair {
  return typeof value === "object" && value !== null && "privateKey" in value && "publicKey" in value
}

async function createKeyPair() {
  const generated = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )
  if (!isCryptoKeyPair(generated)) {
    throw new TypeError("Expected RSA key pair")
  }

  const exported = await crypto.subtle.exportKey("jwk", generated.publicKey)
  if (!isRecord(exported)) {
    throw new TypeError("Expected JWK export")
  }
  const publicJwkRecord = exported
  const kty = typeof publicJwkRecord.kty === "string" ? publicJwkRecord.kty : "RSA"
  const n = typeof publicJwkRecord.n === "string" ? publicJwkRecord.n : ""
  const e = typeof publicJwkRecord.e === "string" ? publicJwkRecord.e : ""
  const ext = typeof publicJwkRecord.ext === "boolean" ? publicJwkRecord.ext : undefined
  const keyOps = Array.isArray(publicJwkRecord.key_ops)
    ? publicJwkRecord.key_ops.filter((entry): entry is string => typeof entry === "string")
    : undefined
  return {
    privateKey: generated.privateKey,
    publicJwk: {
      kty,
      n,
      e,
      use: "sig",
      alg: "RS256",
      kid: "kid-1",
      ...(ext === undefined ? {} : { ext }),
      ...(keyOps === undefined ? {} : { key_ops: keyOps }),
    } as TestGoogleJwk,
  }
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("")
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function encodeJsonBase64Url(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)))
}

async function createSignedJwt(
  privateKey: CryptoKey,
  payloadInput: JwtPayloadInput = {},
  headerInput: Record<string, unknown> = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: "kid-1",
    ...headerInput,
  }
  const payload = {
    sub: "google-sub-1",
    email: "user@example.com",
    aud: "client-123",
    iss: "https://accounts.google.com",
    email_verified: true,
    exp: now + 300,
    ...payloadInput,
  }

  const encodedHeader = encodeJsonBase64Url(header)
  const encodedPayload = encodeJsonBase64Url(payload)
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, signingInput)
  const encodedSignature = toBase64Url(new Uint8Array(signature))

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`
}

function mockJwksResponse(keys: TestGoogleJwk[]) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=0",
      },
    })
  })
}

describe("verifyGoogleIdToken", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns verified payload when token is valid for expected client", async () => {
    const { privateKey, publicJwk } = await createKeyPair()
    mockJwksResponse([publicJwk])
    const token = await createSignedJwt(privateKey)

    await expect(verifyGoogleIdToken(token, "client-123")).resolves.toEqual({
      sub: "google-sub-1",
      email: "user@example.com",
    })
  })

  it("rejects malformed token structures", async () => {
    await expect(verifyGoogleIdToken("invalid", "client-123")).rejects.toThrow("INVALID_TOKEN")
  })

  it("rejects mismatched audience or unverified email", async () => {
    const { privateKey, publicJwk } = await createKeyPair()
    mockJwksResponse([publicJwk])
    const wrongAudience = await createSignedJwt(privateKey, { aud: "different-client" })
    await expect(verifyGoogleIdToken(wrongAudience, "client-123")).rejects.toThrow("FORBIDDEN")

    const unverifiedEmail = await createSignedJwt(privateKey, { email_verified: false })
    await expect(verifyGoogleIdToken(unverifiedEmail, "client-123")).rejects.toThrow("FORBIDDEN")
  })

  it("accepts string email_verified claim", async () => {
    const { privateKey, publicJwk } = await createKeyPair()
    mockJwksResponse([publicJwk])
    const token = await createSignedJwt(privateKey, {
      sub: "google-sub-2",
      email: "verified@example.com",
      email_verified: "true",
    })

    await expect(verifyGoogleIdToken(token, "client-123")).resolves.toEqual({
      sub: "google-sub-2",
      email: "verified@example.com",
    })
  })

  it("rejects invalid issuer", async () => {
    const { privateKey, publicJwk } = await createKeyPair()
    mockJwksResponse([publicJwk])
    const token = await createSignedJwt(privateKey, {
      iss: "https://evil.example.com",
    })

    await expect(verifyGoogleIdToken(token, "client-123")).rejects.toThrow("FORBIDDEN")
  })

  it("rejects expired tokens", async () => {
    const { privateKey, publicJwk } = await createKeyPair()
    mockJwksResponse([publicJwk])
    const token = await createSignedJwt(privateKey, {
      exp: Math.floor(Date.now() / 1000) - 10,
    })

    await expect(verifyGoogleIdToken(token, "client-123")).rejects.toThrow("INVALID_TOKEN")
  })
})
