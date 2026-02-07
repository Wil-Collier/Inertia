# Inertia Security Best Practices Review

Date: 2026-02-07
Scope: React 19 + TypeScript frontend, Cloudflare Worker (Hono) backend, sync/auth/nutrition paths.

## Executive Summary
The codebase has several strong controls already in place (parameterized SQL, JWT signature verification, rotating refresh tokens with hash-at-rest, and schema validation on most API contracts). The highest-priority gap is that access tokens are persisted to `localStorage`, which materially increases account-takeover risk if any XSS occurs. Additional secure-by-default improvements are needed around CSRF hardening for cookie-authenticated endpoints, abuse/rate limiting, no-store cache controls on token responses, and baseline browser security headers/CSP.

## High Severity

### SBP-001: Access token persisted in `localStorage`
- Evidence:
  - `src/features/sync/store.ts:24`
  - `src/features/sync/store.ts:25`
  - `src/features/sync/store.ts:57`
- Why this matters: any successful XSS or malicious extension can exfiltrate the bearer token and call authenticated sync/nutrition APIs until expiry.
- Secure-by-default improvement:
  - Keep access tokens in memory only (non-persisted Zustand store).
  - Use the existing `httpOnly` refresh cookie to restore session on app bootstrap via `POST /api/auth/refresh`.
  - Clear in-memory token immediately on tab close/unload and auth errors.

## Medium Severity

### SBP-002: Cookie-authenticated state-changing endpoints lack explicit CSRF origin checks
- Evidence:
  - `worker/auth/routes.ts:96`
  - `worker/auth/routes.ts:166`
  - `worker/auth/routes.ts:192`
- Why this matters: `SameSite=Lax` helps, but explicit origin validation is a recommended defense-in-depth control for cookie-authenticated POST actions (`refresh`, `logout`).
- Secure-by-default improvement:
  - Validate `Origin` (and fallback `Referer`) against an allowlist env var (for example `APP_ORIGIN`).
  - Reject cross-site/unknown origins with `403` before touching session state.
  - Consider `sameSite: "Strict"` if cross-site flows are not required.

### SBP-003: No rate limiting / abuse controls on authentication and sync endpoints
- Evidence:
  - `worker/auth/routes.ts:28`
  - `worker/auth/routes.ts:96`
  - `worker/sync/routes.ts:125`
  - `worker/sync/routes.ts:335`
- Why this matters: endpoints are vulnerable to automated abuse (credential/token endpoint hammering, high-cost sync flooding, D1 write amplification).
- Secure-by-default improvement:
  - Apply Cloudflare WAF/Rate Limiting rules per IP and per route class (`/api/auth/*`, `/api/sync/*`).
  - Add user/session-aware server-side throttling (e.g., Durable Object or KV token bucket) for sync write paths.
  - Cap request body sizes defensively at the edge for `/api/sync/push`.

### SBP-004: Token-bearing auth responses are not marked `Cache-Control: no-store`
- Evidence:
  - `worker/auth/routes.ts:78`
  - `worker/auth/routes.ts:160`
- Why this matters: auth responses containing bearer tokens should be explicitly non-cacheable to reduce token retention in intermediary/browser caches.
- Secure-by-default improvement:
  - Set `Cache-Control: no-store` (and `Pragma: no-cache`) on login/refresh/logout responses.

### SBP-005: Missing explicit browser security header baseline (including CSP)
- Evidence:
  - `worker/index.ts:20`
  - `index.html:3`
- Why this matters: without a defined CSP and baseline headers, exploit impact increases if client-side injection appears later (or via third-party scripts).
- Secure-by-default improvement:
  - Add a CSP suitable for Vite bundles and Google sign-in scripts.
  - Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive `Permissions-Policy`.
  - Enforce clickjacking protection via CSP `frame-ancestors 'none'` (or explicit allowlist).

## Low Severity

### SBP-006: Google token verification path lacks timeout and explicit issuer validation
- Evidence:
  - `worker/auth/google.ts:6`
  - `worker/auth/google.ts:8`
  - `worker/auth/google.ts:24`
- Why this matters: network hangs can degrade availability, and explicit issuer checks provide stronger long-term validation guarantees.
- Secure-by-default improvement:
  - Add fetch timeout/abort for token verification calls.
  - Enforce `iss` in `{ "accounts.google.com", "https://accounts.google.com" }` in addition to `aud` and verified email.
  - Consider local JWT verification against Google JWKS to avoid remote token introspection dependence.

### SBP-007: Nutrition query params are minimally validated
- Evidence:
  - `worker/nutrition/routes.ts:23`
  - `worker/nutrition/routes.ts:32`
  - `worker/nutrition/routes.ts:65`
- Why this matters: unbounded/loosely validated search and barcode inputs can increase external API abuse and cost exposure.
- Secure-by-default improvement:
  - Enforce max query length and character policy for `q`.
  - Validate barcode format/length (numeric and expected lengths).
  - Constrain `region`/`language` to known patterns.

## Positive Security Practices Already Present
- Parameterized D1 SQL queries are used throughout auth/sync paths.
- Refresh tokens are opaque, rotated, and stored hashed (`token_hash_current`/`token_hash_previous`) instead of plaintext.
- JWT `exp` is set on issued access tokens and signature verification is enforced in auth middleware.
- Request schemas are validated with Zod for core sync/auth payloads.

## Suggested Implementation Order
1. SBP-001 (`localStorage` token persistence).
2. SBP-002 + SBP-004 (CSRF origin checks + no-store headers on auth endpoints).
3. SBP-003 (edge + app-layer rate limiting).
4. SBP-005 (headers + CSP rollout with report-only phase first).
5. SBP-006 and SBP-007 hardening.
