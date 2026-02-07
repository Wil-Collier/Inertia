import type { D1Database } from "@cloudflare/workers-types"

export async function logAudit(
  db: D1Database,
  entry: { userId: string; userEmail: string; action: string; details?: Record<string, unknown> }
): Promise<void> {
  const details = entry.details ? JSON.stringify(entry.details) : null
  await db
    .prepare("INSERT INTO audit_log (user_id, user_email, action, details) VALUES (?, ?, ?, ?)")
    .bind(entry.userId, entry.userEmail, entry.action, details)
    .run()
}
