import { describe, expect, it, vi, afterEach } from "vitest"
import {
  formatDate,
  getToday,
  getWeekDates,
  getYesterday,
  getThirtyDaysAgo,
  getNinetyDaysAgo,
  parseDbDate,
} from "@/lib/dateUtils"

describe("dateUtils", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe("parseDbDate", () => {
    it("parses DB dates as local calendar dates", () => {
      const parsed = parseDbDate("2026-02-07")

      expect(parsed.getFullYear()).toBe(2026)
      expect(parsed.getMonth()).toBe(1)
      expect(parsed.getDate()).toBe(7)
    })

    it("throws for invalid DB date strings", () => {
      expect(() => parseDbDate("invalid-date")).toThrow("Invalid DB date")
    })

    it("throws for empty string", () => {
      expect(() => parseDbDate("")).toThrow("Invalid DB date")
    })

    it("throws for partial date strings", () => {
      expect(() => parseDbDate("2026-02")).toThrow("Invalid DB date")
    })

    it("parses single-digit month and day with leading zeros", () => {
      const parsed = parseDbDate("2026-01-05")

      expect(parsed.getFullYear()).toBe(2026)
      expect(parsed.getMonth()).toBe(0)
      expect(parsed.getDate()).toBe(5)
    })

    it("parses December 31 correctly", () => {
      const parsed = parseDbDate("2025-12-31")

      expect(parsed.getFullYear()).toBe(2025)
      expect(parsed.getMonth()).toBe(11)
      expect(parsed.getDate()).toBe(31)
    })

    it("parses January 1 correctly", () => {
      const parsed = parseDbDate("2026-01-01")

      expect(parsed.getFullYear()).toBe(2026)
      expect(parsed.getMonth()).toBe(0)
      expect(parsed.getDate()).toBe(1)
    })
  })

  describe("formatDate", () => {
    it("formats dates as yyyy-MM-dd", () => {
      expect(formatDate(new Date(2026, 1, 7))).toBe("2026-02-07")
    })

    it("pads single-digit months and days with leading zeros", () => {
      expect(formatDate(new Date(2026, 0, 5))).toBe("2026-01-05")
    })

    it("formats a timestamp number as yyyy-MM-dd", () => {
      const timestamp = new Date(2026, 5, 15).getTime()
      expect(formatDate(timestamp)).toBe("2026-06-15")
    })
  })

  describe("getToday", () => {
    it("returns today in yyyy-MM-dd format", () => {
      expect(getToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it("returns the correct pinned date", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 2, 15))

      expect(getToday()).toBe("2026-03-15")
    })
  })

  describe("getYesterday", () => {
    it("returns yesterday in yyyy-MM-dd format", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 2, 15))

      expect(getYesterday()).toBe("2026-03-14")
    })

    it("handles month boundary (March 1 → February 28)", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 2, 1))

      expect(getYesterday()).toBe("2026-02-28")
    })

    it("handles year boundary (January 1 → December 31)", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 1))

      expect(getYesterday()).toBe("2025-12-31")
    })
  })

  describe("getThirtyDaysAgo", () => {
    it("returns date 30 days before today in yyyy-MM-dd format", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 2, 15))

      expect(getThirtyDaysAgo()).toBe("2026-02-13")
    })

    it("handles crossing year boundary", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 0, 15))

      expect(getThirtyDaysAgo()).toBe("2025-12-16")
    })
  })

  describe("getNinetyDaysAgo", () => {
    it("returns date 90 days before today in yyyy-MM-dd format", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 2, 15))

      expect(getNinetyDaysAgo()).toBe("2025-12-15")
    })
  })

  describe("getWeekDates", () => {
    it("returns seven week dates and includes reference day", () => {
      const reference = new Date(2026, 1, 7)
      const week = getWeekDates(reference)

      expect(week).toHaveLength(7)
      expect(week).toContain("2026-02-07")
    })

    it("returns all dates in yyyy-MM-dd format", () => {
      const reference = new Date(2026, 1, 7)
      const week = getWeekDates(reference)

      for (const date of week) {
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it("starts week on Sunday (date-fns default)", () => {
      // Feb 7, 2026 is a Saturday
      const reference = new Date(2026, 1, 7)
      const week = getWeekDates(reference)

      // Week should start on Sunday Feb 1
      expect(week[0]).toBe("2026-02-01")
      // and end on Saturday Feb 7
      expect(week[6]).toBe("2026-02-07")
    })

    it("handles week crossing month boundary", () => {
      // March 1, 2026 is a Sunday
      const reference = new Date(2026, 2, 1)
      const week = getWeekDates(reference)

      expect(week).toHaveLength(7)
      expect(week[0]).toBe("2026-03-01")
      expect(week[6]).toBe("2026-03-07")
    })

    it("defaults to current date when no argument provided", () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 1, 7))

      const week = getWeekDates()

      expect(week).toHaveLength(7)
      expect(week).toContain("2026-02-07")
    })
  })
})
