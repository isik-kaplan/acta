export interface User {
  id: string
  email: string
  display_name: string
}

export interface BoardSummary {
  id: string
  name: string
}

export interface Card {
  id: string
  column_id: string
  title: string
  // One line under the title on the board; notes are the full write-up.
  summary: string
  notes: string
  // ISO 8601, always UTC ("...Z") from the server.
  due_at: string | null
  // Minutes before due_at to push a reminder, smallest first. 0 is at the due time.
  reminders: number[]
  // Label ids, in the board's label order.
  labels: string[]
  position: number
}

export interface Column {
  id: string
  name: string
  position: number
  cards: Card[]
}

export type LabelColor =
  | 'blue'
  | 'orange'
  | 'green'
  | 'pink'
  | 'violet'
  | 'yellow'
  | 'teal'
  | 'red'
  | 'indigo'
  | 'lime'
  | 'fuchsia'
  | 'cyan'
  | 'amber'
  | 'purple'
  | 'emerald'
  | 'rose'
  | 'sky'
  | 'brown'
  | 'slate'

export interface Label {
  id: string
  name: string
  color: LabelColor
}

export interface Board {
  id: string
  name: string
  columns: Column[]
  labels: Label[]
}

export interface CardFields {
  title: string
  summary: string
  notes: string
  due_at: string | null
  reminders: number[]
  labels: string[]
}

// The browser's own PushSubscription.toJSON() shape, which the server takes as is.
export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
