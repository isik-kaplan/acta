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
  notes: string
  // ISO 8601, always UTC ("...Z") from the server.
  due_at: string | null
  position: number
}

export interface Column {
  id: string
  name: string
  position: number
  cards: Card[]
}

export interface Board {
  id: string
  name: string
  columns: Column[]
}

export interface CardFields {
  title: string
  notes: string
  due_at: string | null
}

// The browser's own PushSubscription.toJSON() shape, which the server takes as is.
export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
