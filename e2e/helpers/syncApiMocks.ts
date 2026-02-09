import type { Page, Route } from "@playwright/test"
import type { ErrorResponse, PullResponse, PushResponse, RefreshResponse } from "../../shared/syncSchemas"

interface SyncApiMockOptions {
  refreshStatus?: number
  refreshBody?: RefreshResponse | ErrorResponse
  logoutStatus?: number
  logoutBody?: { success: true } | ErrorResponse
  pullStatus?: number
  pullBody?: PullResponse | ErrorResponse
  pushStatus?: number
  pushBody?: PushResponse | ErrorResponse
}

const DEFAULT_REFRESH_ERROR: ErrorResponse = {
  error: "UNAUTHORIZED",
  message: "Missing refresh token",
}

const DEFAULT_AUTH_REFRESH_RESPONSE: RefreshResponse = {
  accessToken: "test-access-token",
  userId: "test-user-id",
  email: "athlete@example.com",
  expiresAtMs: Date.now() + 60 * 60 * 1000,
}

const DEFAULT_LOGOUT_RESPONSE = {
  success: true as const,
}

const DEFAULT_PULL_RESPONSE: PullResponse = {
  changes: [],
  nextCursor: null,
  serverTimestampMs: Date.now(),
  hasMore: false,
}

const DEFAULT_PUSH_RESPONSE: PushResponse = {
  accepted: 0,
  acceptedChanges: [],
  conflicts: [],
}

function isPost(route: Route): boolean {
  return route.request().method() === "POST"
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}

export async function registerSyncApiMocks(page: Page, options: SyncApiMockOptions = {}): Promise<void> {
  const refreshStatus = options.refreshStatus ?? 401
  const refreshBody = options.refreshBody ?? DEFAULT_REFRESH_ERROR
  const logoutStatus = options.logoutStatus ?? 200
  const logoutBody = options.logoutBody ?? DEFAULT_LOGOUT_RESPONSE
  const pullStatus = options.pullStatus ?? 200
  const pullBody = options.pullBody ?? DEFAULT_PULL_RESPONSE
  const pushStatus = options.pushStatus ?? 200
  const pushBody = options.pushBody ?? DEFAULT_PUSH_RESPONSE

  await page.route("**/api/auth/refresh", async (route) => {
    if (!isPost(route)) {
      await route.fallback()
      return
    }
    await fulfillJson(route, refreshStatus, refreshBody)
  })

  await page.route("**/api/auth/logout", async (route) => {
    if (!isPost(route)) {
      await route.fallback()
      return
    }
    await fulfillJson(route, logoutStatus, logoutBody)
  })

  await page.route("**/api/sync/pull", async (route) => {
    if (!isPost(route)) {
      await route.fallback()
      return
    }
    await fulfillJson(route, pullStatus, pullBody)
  })

  await page.route("**/api/sync/push", async (route) => {
    if (!isPost(route)) {
      await route.fallback()
      return
    }
    await fulfillJson(route, pushStatus, pushBody)
  })
}

export async function registerUnauthenticatedSyncApiMocks(page: Page): Promise<void> {
  await registerSyncApiMocks(page, {
    refreshStatus: 401,
    refreshBody: DEFAULT_REFRESH_ERROR,
  })
}

interface AuthenticatedSyncMockOptions {
  refreshBody?: RefreshResponse
  pullBody?: PullResponse
  pushBody?: PushResponse
}

export async function registerAuthenticatedSyncApiMocks(
  page: Page,
  options: AuthenticatedSyncMockOptions = {}
): Promise<void> {
  await registerSyncApiMocks(page, {
    refreshStatus: 200,
    refreshBody: options.refreshBody ?? DEFAULT_AUTH_REFRESH_RESPONSE,
    pullStatus: 200,
    pullBody: options.pullBody ?? DEFAULT_PULL_RESPONSE,
    pushStatus: 200,
    pushBody: options.pushBody ?? DEFAULT_PUSH_RESPONSE,
    logoutStatus: 200,
    logoutBody: DEFAULT_LOGOUT_RESPONSE,
  })
}
