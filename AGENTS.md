# AGENTS.md - Inertia

The role of this file is to describe common mistakes and confusion points that agents might encounter as they work in this project. If you ever encounter something in the project that surprises you, please alert the developer working with you and indicate that this is the case in the AGENTS.md file to help prevent future agents from having the same issue.

This file should stay high-signal: keep only project-specific pitfalls that are easy to miss during normal code exploration.

## Project Overview

Inertia is an offline-first PWA for tracking workouts, nutrition, and body progress. Built with React 19, Vite 7, TypeScript (native preview compiler via `tsgo`), TanStack Router, and Dexie.js (IndexedDB) for local-first persistence. Backend runs on Cloudflare Workers with Hono.


## Non-Obvious Constraints

- The app is still in early development with no real users; do not optimize for migration plans or backward compatibility unless explicitly requested. Our goal is too interate quickly.
- Default exercises are static in `src/data/exerciseDatabase.ts`; only user-created exercises belong in `customExercises`.
- Singleton records use fixed IDs: settings => `id: "settings"`, achievements => `id: "achievements"`.

## Sync-Critical Writes

- Every Dexie write transaction must include sync tracking tables with domain tables:
  - `db.syncPendingChanges`
  - `db.syncRecordVersions`
- If these are omitted, local writes may not sync correctly.
- After relevant DB writes, run required cross-cutting side effects (for example achievement-related side effects) rather than only mutating tables.

## State And Routing Boundaries

- Persisted app data should use React Query + Dexie; Zustand is for ephemeral UI state only.
- Keep `src/pages/*` thin and place real page implementations in `src/features/*/screens/*Screen.tsx`.

## Product Guardrails

- Offline-first is strict: local workflows must not depend on network availability.
- Auth model guardrail: access tokens stay in memory only; refresh tokens stay in `httpOnly` cookies.
