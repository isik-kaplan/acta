import type { Board, Card, Column } from '../api/types'

export interface Placement {
  columnId: string
  index: number
}

// Drop targets are namespaced: a card and a column could otherwise share an id space with
// nothing to tell `over.id` apart by.
export const cardTarget = (cardId: string) => `card:${cardId}`
export const columnTarget = (columnId: string) => `column:${columnId}`

export function findCard(board: Board, cardId: string | null): Card | undefined {
  return board.columns.flatMap((column) => column.cards).find((card) => card.id === cardId)
}

function withPositions<T extends { position: number }>(items: T[]): T[] {
  return items.map((item, position) => ({ ...item, position }))
}

/** The same move the server makes for POST /cards/:id/move, applied locally so the card lands
 * the moment it's dropped rather than a round trip later. */
export function moveCardLocally(board: Board, cardId: string, placement: Placement): Board {
  const card = findCard(board, cardId)
  if (!card) return board
  const columns = board.columns.map((column) => ({
    ...column,
    cards: column.cards.filter((each) => each.id !== cardId),
  }))
  return {
    ...board,
    columns: columns.map((column) => {
      if (column.id !== placement.columnId) {
        return { ...column, cards: withPositions(column.cards) }
      }
      const cards = [...column.cards]
      cards.splice(placement.index, 0, { ...card, column_id: column.id })
      return { ...column, cards: withPositions(cards) }
    }),
  }
}

/** Where a dragged card goes when let go over `overId`. Dropped on a card, it takes that card's
 * place, and the card it lands on shifts toward where the dragged one came from - so dropping on
 * the neighbour below swaps the two, not nothing. Dropped on a column's empty space, it goes to
 * the bottom. Null when nothing would change. */
export function resolveDrop(board: Board, cardId: string, overId: string): Placement | null {
  const [kind, id] = overId.split(/:(.*)/)
  let column: Column | undefined
  let index: number
  if (kind === 'column') {
    column = board.columns.find((each) => each.id === id)
    if (!column) return null
    index = column.cards.filter((card) => card.id !== cardId).length
  } else {
    column = board.columns.find((each) => each.cards.some((card) => card.id === id))
    if (!column) return null
    index = column.cards.findIndex((card) => card.id === id)
  }
  const current = findCard(board, cardId)
  if (current?.column_id === column.id && current.position === index) return null
  return { columnId: column.id, index }
}

function mapColumn(board: Board, columnId: string, update: (column: Column) => Column): Board {
  return { ...board, columns: board.columns.map((column) => (column.id === columnId ? update(column) : column)) }
}

export function addCard(board: Board, card: Card): Board {
  return mapColumn(board, card.column_id, (column) => ({ ...column, cards: [...column.cards, card] }))
}

export function replaceCard(board: Board, card: Card): Board {
  return mapColumn(board, card.column_id, (column) => ({
    ...column,
    cards: column.cards.map((each) => (each.id === card.id ? card : each)),
  }))
}

export function removeCard(board: Board, cardId: string): Board {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      cards: withPositions(column.cards.filter((each) => each.id !== cardId)),
    })),
  }
}

export function addColumn(board: Board, column: Column): Board {
  return { ...board, columns: [...board.columns, column] }
}

export function removeColumn(board: Board, columnId: string): Board {
  return { ...board, columns: withPositions(board.columns.filter((column) => column.id !== columnId)) }
}
