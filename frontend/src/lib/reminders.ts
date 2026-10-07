export type ReminderUnit = 'minutes' | 'hours' | 'days' | 'weeks'

/** One reminder as the editor holds it: what's typed, in the unit picked. */
export interface ReminderDraft {
  amount: string
  unit: ReminderUnit
}

export const UNIT_MINUTES: Record<ReminderUnit, number> = { minutes: 1, hours: 60, days: 1_440, weeks: 10_080 }

const LARGEST_FIRST: ReminderUnit[] = ['weeks', 'days', 'hours', 'minutes']

/** The largest unit the amount comes out whole in - 2880 reads as 2 days, 90 as 90 minutes. */
export function toDraft(minutes: number): ReminderDraft {
  const unit = minutes === 0 ? 'minutes' : LARGEST_FIRST.find((each) => minutes % UNIT_MINUTES[each] === 0)!
  return { amount: String(minutes / UNIT_MINUTES[unit]), unit }
}

/** Minutes before the due time, or null for anything that isn't a whole amount. Any distance ahead
 * goes, up to where a JavaScript number stops counting exactly (millions of millennia). */
export function toMinutes({ amount, unit }: ReminderDraft): number | null {
  if (!/^\d+$/.test(amount.trim())) return null
  const minutes = Number(amount) * UNIT_MINUTES[unit]
  return Number.isSafeInteger(minutes) ? minutes : null
}

/** What gets saved: the valid ones, each once, soonest-before first. */
export function collectReminders(drafts: ReminderDraft[]): number[] {
  const minutes = drafts.map(toMinutes).filter((each): each is number => each !== null)
  return [...new Set(minutes)].sort((a, b) => a - b)
}
