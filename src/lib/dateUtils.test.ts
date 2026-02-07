import { describe, expect, it } from "vitest"
import { formatDate, getToday, getWeekDates, parseDbDate } from "@/lib/dateUtils"

describe("dateUtils", () => {
  it("parses DB dates as local calendar dates", () => {
    const parsed = parseDbDate("2026-02-07")

    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(1)
    expect(parsed.getDate()).toBe(7)
  })

  it("throws for invalid DB date strings", () => {
    expect(() => parseDbDate("invalid-date")).toThrow("Invalid DB date")
  })

  it("formats dates as yyyy-MM-dd", () => {
    expect(formatDate(new Date(2026, 1, 7))).toBe("2026-02-07")
  })

  it("returns seven week dates and includes reference day", () => {
    const reference = new Date(2026, 1, 7)
    const week = getWeekDates(reference)

    expect(week).toHaveLength(7)
    expect(week).toContain("2026-02-07")
    expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
