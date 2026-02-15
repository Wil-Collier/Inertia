import Dexie, { type Table } from "dexie"
import { db } from "@/services/db"

export async function withOptionalTransaction<T>(
  tables: Table[],
  fn: () => Promise<T>
): Promise<T> {
  if (Dexie.currentTransaction) {
    return await fn()
  }
  return await db.transaction("rw", tables, fn)
}
