export class SyncSessionInactiveError extends Error {
  constructor(message = "Sync session is no longer authenticated") {
    super(message)
    this.name = "SyncSessionInactiveError"
  }
}

export type AccessTokenSource = string | (() => string)

export function readAccessToken(source: AccessTokenSource): string {
  const token = typeof source === "function" ? source() : source
  if (typeof token !== "string" || token.length === 0) {
    throw new SyncSessionInactiveError()
  }
  return token
}
