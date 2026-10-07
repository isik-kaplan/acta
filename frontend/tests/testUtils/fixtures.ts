import type { Board, Card, Label, User } from '../../src/api/types'

export const USER: User = { id: 'u1', email: 'ada@acta.local', display_name: 'Ada' }

export function card(id: string, columnId: string, position: number, overrides: Partial<Card> = {}): Card {
  return {
    id,
    column_id: columnId,
    title: id.toUpperCase(),
    summary: '',
    notes: '',
    due_at: null,
    reminders: [],
    labels: [],
    position,
    ...overrides,
  }
}

/** To do: a, b, c · Doing: d · Done: (empty) */
export function makeBoard(): Board {
  return {
    id: 'b1',
    name: 'My board',
    columns: [
      {
        id: 'todo',
        name: 'To do',
        position: 0,
        cards: [card('a', 'todo', 0), card('b', 'todo', 1), card('c', 'todo', 2)],
      },
      { id: 'doing', name: 'Doing', position: 1, cards: [card('d', 'doing', 0)] },
      { id: 'done', name: 'Done', position: 2, cards: [] },
    ],
    labels: [],
  }
}

/** Urgent (red), Home (green), Errand (teal) - in that, the board's, order. */
export const LABELS: Label[] = [
  { id: 'l-urgent', name: 'Urgent', color: 'red' },
  { id: 'l-home', name: 'Home', color: 'green' },
  { id: 'l-errand', name: 'Errand', color: 'teal' },
]

/** makeBoard() with LABELS on it: a has Urgent, b has Home and Errand, d has Errand. */
export function makeLabelledBoard(): Board {
  const board = makeBoard()
  const labelsOf: Record<string, string[]> = { a: ['l-urgent'], b: ['l-home', 'l-errand'], d: ['l-errand'] }
  return {
    ...board,
    labels: LABELS,
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((each) => ({ ...each, labels: labelsOf[each.id] ?? [] })),
    })),
  }
}

/** Each column's card ids, in order - the shape most board assertions care about. */
export function layout(board: Board): Record<string, string[]> {
  return Object.fromEntries(board.columns.map((column) => [column.id, column.cards.map((each) => each.id)]))
}
