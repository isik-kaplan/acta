export type DueStatus = 'overdue' | 'today' | 'later'

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function dayOffset(due: Date, now: Date): number {
  // Rounded: a day that crosses a DST change is 23 or 25 hours long.
  return Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS)
}

export function dueStatus(dueAt: string, now: Date): DueStatus {
  const due = new Date(dueAt)
  if (due.getTime() <= now.getTime()) return 'overdue'
  return dayOffset(due, now) === 0 ? 'today' : 'later'
}

const RELATIVE_DAYS: Record<number, string> = { [-1]: 'Yesterday', 0: 'Today', 1: 'Tomorrow' }

export function formatDue(dueAt: string, now: Date): string {
  const due = new Date(dueAt)
  const day =
    RELATIVE_DAYS[dayOffset(due, now)] ??
    due.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: due.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    })
  return `${day} ${due.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** An ISO instant as the local "YYYY-MM-DDTHH:mm" a datetime-local input shows. */
export function toLocalInput(dueAt: string): string {
  const due = new Date(dueAt)
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}T${pad(due.getHours())}:${pad(due.getMinutes())}`
}

/** A datetime-local value, read as local time, back to an ISO instant - or null when empty. */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
