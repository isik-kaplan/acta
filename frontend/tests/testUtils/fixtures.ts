import type { Board, Card, User } from '../../src/api/types'

export const USER: User = { id: 'u1', email: 'ada@acta.local', display_name: 'Ada' }

export function card(id: string, columnId: string, position: number, overrides: Partial<Card> = {}): Card {
  return { id, column_id: columnId, title: id.toUpperCase(), notes: '', due_at: null, position, ...overrides }
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
  }
}

/** Each column's card ids, in order - the shape most board assertions care about. */
export function layout(board: Board): Record<string, string[]> {
  return Object.fromEntries(board.columns.map((column) => [column.id, column.cards.map((each) => each.id)]))
}
