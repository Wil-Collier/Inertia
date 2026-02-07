export interface VerifiedGoogleToken {
  sub: string
  email: string
}

export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<VerifiedGoogleToken> {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error("INVALID_TOKEN")
  }

  const data = await response.json()
  if (!isRecord(data)) {
    throw new Error("INVALID_TOKEN")
  }

  const sub = typeof data.sub === "string" ? data.sub : null
  if (!sub) {
    throw new Error("INVALID_TOKEN")
  }

  if (data.aud !== clientId) {
    throw new Error("FORBIDDEN")
  }

  const verified = data.email_verified === true || data.email_verified === "true"
  if (!verified) {
    throw new Error("FORBIDDEN")
  }

  return {
    sub,
    email: typeof data.email === "string" ? data.email : "",
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
