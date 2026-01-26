import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns"

export const DB_DATE_FORMAT = "yyyy-MM-dd"

/**
 * Parse a DB date string (yyyy-MM-dd) as a local date.
 *
 * Important: `new Date("yyyy-MM-dd")` is parsed as UTC by JS, which shifts
 * dates in non-UTC timezones.
 */
export function parseDbDate(dateStr: string): Date {
  const [yStr, mStr, dStr] = dateStr.split("-")
  const year = Number(yStr)
  const monthIndex = Number(mStr) - 1
  const day = Number(dStr)

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || !Number.isFinite(day)) {
    throw new Error(`Invalid DB date: ${dateStr}`)
  }

  return new Date(year, monthIndex, day)
}

/**
 * Returns today's date formatted for DB storage (yyyy-MM-dd)
 */
export const getToday = () => format(new Date(), DB_DATE_FORMAT)

/**
 * Formats a date object or timestamp to DB storage string
 */
export const formatDate = (date: Date | number) => format(date, DB_DATE_FORMAT)

/**
 * Returns date string for 30 days ago
 */
export const getThirtyDaysAgo = () => format(subDays(new Date(), 30), DB_DATE_FORMAT)

/**
 * Returns date string for 90 days ago
 */
export const getNinetyDaysAgo = () => format(subDays(new Date(), 90), DB_DATE_FORMAT)

/**
 * Returns date string for yesterday
 */
export const getYesterday = () => format(subDays(new Date(), 1), DB_DATE_FORMAT)

/**
 * Get all dates in a week for a given reference date
 */
export const getWeekDates = (referenceDate: Date = new Date()) => {
  const start = startOfWeek(referenceDate)
  const end = endOfWeek(referenceDate)
  return eachDayOfInterval({ start, end }).map(d => format(d, DB_DATE_FORMAT))
}
