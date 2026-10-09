import type { Board, Card, Column, Label } from '../api/types'

export interface Placement {
  columnId: string
  index: number
}

// Cards and columns are dragged and dropped on under one id space, so each id carries what it
// names - nothing else would tell `active.id` or `over.id` apart.
const CARD = 'card:'
const LANE = 'lane:'
export const cardTarget = (cardId: string) => `${CARD}${cardId}`
export const laneTarget = (columnId: string) => `${LANE}${columnId}`

const unprefixed = (prefix: string) => (id: string) => (id.startsWith(prefix) ? id.slice(prefix.length) : null)
/** The card a drag or drop id names, or null when it names a column. */
export const targetCard = unprefixed(CARD)
/** The column a drag or drop id names, or null when it names a card. */
export const targetColumn = unprefixed(LANE)

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

/** The column a drop lands in: the one it's over, or the one holding the card it's over. */
function columnAt(board: Board, overId: string): Column | undefined {
  const columnId = targetColumn(overId)
  if (columnId !== null) return board.columns.find((column) => column.id === columnId)
  return board.columns.find((column) => column.cards.some((card) => cardTarget(card.id) === overId))
}

interface Span {
  top: number
  height: number
}

const middle = (box: Span) => box.top + box.height / 2

/** Whether a dragged box's middle has passed the middle of the box it's over - from there on, it
 * goes after it. */
export function isPastMiddle(dragged: Span | null, over: Span): boolean {
  return dragged !== null && middle(dragged) > middle(over)
}

/** The board while a card is dragged over `overId`. Over another column, the card moves into it, so
 * that column opens a gap where it would land: in front of the card it's over (behind it once
 * `pastMiddle`), or at the bottom over the column's empty space. Within its own column the drag
 * library shifts the cards around it, so the board is left as it is - as it is for a dragged
 * column, which has no `cardId`. */
export function previewCardOver(board: Board, cardId: string | null, overId: string, pastMiddle: boolean): Board {
  const card = findCard(board, cardId)
  const column = columnAt(board, overId)
  if (!card || !column || column.id === card.column_id) return board
  const overIndex = column.cards.findIndex((each) => cardTarget(each.id) === overId)
  const index = overIndex === -1 ? column.cards.length : overIndex + Number(pastMiddle)
  return moveCardLocally(board, card.id, { columnId: column.id, index })
}

/** Where a dragged card lands when let go over `overId`, in the column `preview` has it in by then.
 * Dropped on a card, it takes that card's place, and the card it lands on shifts toward where the
 * dragged one came from - so dropping on the neighbour below swaps the two, not nothing. Dropped
 * anywhere else, it stays where the preview has it. Null when that's where it started on `board`. */
export function resolveCardDrop(board: Board, preview: Board, cardId: string, overId: string | null): Placement | null {
  const card = findCard(preview, cardId)
  if (!card) return null
  const column = preview.columns.find((each) => each.id === card.column_id)!
  const overIndex = column.cards.findIndex((each) => cardTarget(each.id) === overId)
  const index = overIndex === -1 ? card.position : overIndex
  const start = findCard(board, cardId)
  if (start?.column_id === column.id && start.position === index) return null
  return { columnId: column.id, index }
}

/** The same move the server makes for POST /columns/:id/move, applied locally so the column lands
 * the moment it's dropped. */
export function moveColumnLocally(board: Board, columnId: string, index: number): Board {
  const column = board.columns.find((each) => each.id === columnId)
  if (!column) return board
  const columns = board.columns.filter((each) => each.id !== columnId)
  columns.splice(index, 0, column)
  return { ...board, columns: withPositions(columns) }
}

/** Where a dragged column goes when let go over `overId`: into the place of the column it's
 * dropped on, which shifts toward where the dragged one came from. Null when nothing would change,
 * or when it's let go over nothing. */
export function resolveColumnDrop(board: Board, columnId: string, overId: string | null): number | null {
  const index = board.columns.findIndex((column) => laneTarget(column.id) === overId)
  if (index === -1 || board.columns[index].id === columnId) return null
  return index
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

export function addLabel(board: Board, label: Label): Board {
  return { ...board, labels: [...board.labels, label] }
}

export function replaceLabel(board: Board, label: Label): Board {
  return { ...board, labels: board.labels.map((each) => (each.id === label.id ? label : each)) }
}

/** The label gone from the board, and so from every card that had it. */
export function removeLabel(board: Board, labelId: string): Board {
  return {
    ...board,
    labels: board.labels.filter((label) => label.id !== labelId),
    columns: board.columns.map((column) => ({
      ...column,
      cards: column.cards.map((card) => ({ ...card, labels: card.labels.filter((each) => each !== labelId) })),
    })),
  }
}
