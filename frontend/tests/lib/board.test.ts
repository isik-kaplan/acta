import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'

import {
  addCard,
  addColumn,
  addLabel,
  cardTarget,
  findCard,
  isPastMiddle,
  laneTarget,
  moveCardLocally,
  moveColumnLocally,
  previewCardOver,
  removeCard,
  removeColumn,
  removeLabel,
  replaceCard,
  replaceLabel,
  resolveCardDrop,
  resolveColumnDrop,
  targetCard,
  targetColumn,
} from '../../src/lib/board'
import { LABELS, card, layout, makeBoard, makeLabelledBoard } from '../testUtils/fixtures'

describe('targets', () => {
  it('namespaces card and column ids', () => {
    expect(cardTarget('x')).toBe('card:x')
    expect(laneTarget('x')).toBe('lane:x')
  })

  it('reads back what an id names, colons in the id and all', () => {
    expect(targetCard(cardTarget('x:y'))).toBe('x:y')
    expect(targetColumn(laneTarget('x:y'))).toBe('x:y')
    expect(targetCard(laneTarget('x'))).toBeNull()
    expect(targetColumn(cardTarget('x'))).toBeNull()
    expect(targetColumn('card:lane:x')).toBeNull()
  })
})

describe('findCard', () => {
  it('finds a card in any column, or nothing', () => {
    expect(findCard(makeBoard(), 'd')?.title).toBe('D')
    expect(findCard(makeBoard(), 'zzz')).toBeUndefined()
    expect(findCard(makeBoard(), null)).toBeUndefined()
  })
})

describe('moveCardLocally', () => {
  it('moves a card into another column at the index and renumbers both columns', () => {
    const board = makeBoard()
    const moved = moveCardLocally(board, 'a', { columnId: 'doing', index: 0 })
    expect(layout(moved)).toEqual({ todo: ['b', 'c'], doing: ['a', 'd'], done: [] })
    expect(moved.columns[0].cards.map((each) => each.position)).toEqual([0, 1])
    expect(moved.columns[1].cards.map((each) => each.position)).toEqual([0, 1])
    expect(findCard(moved, 'a')?.column_id).toBe('doing')
    expect(moved.id).toBe('b1')
    expect(moved.name).toBe('My board')
    expect(layout(board)).toEqual({ todo: ['a', 'b', 'c'], doing: ['d'], done: [] })
  })

  it('reorders within a column', () => {
    expect(layout(moveCardLocally(makeBoard(), 'a', { columnId: 'todo', index: 2 })).todo).toEqual(['b', 'c', 'a'])
    expect(layout(moveCardLocally(makeBoard(), 'c', { columnId: 'todo', index: 0 })).todo).toEqual(['c', 'a', 'b'])
  })

  it('leaves the board alone for a card it does not have', () => {
    const board = makeBoard()
    expect(moveCardLocally(board, 'zzz', { columnId: 'todo', index: 0 })).toBe(board)
  })

  test.prop([fc.constantFrom('a', 'b', 'c', 'd'), fc.constantFrom('todo', 'doing', 'done'), fc.nat(5)])(
    'keeps every card exactly once with dense positions',
    (cardId, columnId, index) => {
      const moved = moveCardLocally(makeBoard(), cardId, { columnId, index })
      const ids = moved.columns.flatMap((column) => column.cards.map((each) => each.id))
      expect(ids.sort()).toEqual(['a', 'b', 'c', 'd'])
      for (const column of moved.columns) {
        expect(column.cards.map((each) => each.position)).toEqual(column.cards.map((_, position) => position))
        expect(column.cards.every((each) => each.column_id === column.id)).toBe(true)
      }
    }
  )
})

describe('isPastMiddle', () => {
  it("is true once the dragged box's middle is below the middle of the one it's over", () => {
    const over = { top: 100, height: 50 }
    expect(isPastMiddle({ top: 101, height: 50 }, over)).toBe(true)
    expect(isPastMiddle({ top: 100, height: 50 }, over)).toBe(false)
    expect(isPastMiddle({ top: 99, height: 50 }, over)).toBe(false)
    // Middles, not edges: a short box low in a tall one has passed its middle.
    expect(isPastMiddle({ top: 140, height: 10 }, { top: 100, height: 60 })).toBe(true)
    expect(isPastMiddle({ top: 100, height: 100 }, { top: 100, height: 60 })).toBe(true)
  })

  it('is false with no dragged box measured yet', () => {
    expect(isPastMiddle(null, { top: 0, height: 50 })).toBe(false)
  })
})

describe('previewCardOver', () => {
  it("moves the card into another column in front of the card it's over", () => {
    const board = makeBoard()
    const preview = previewCardOver(board, 'a', 'card:d', false)
    expect(layout(preview)).toEqual({ todo: ['b', 'c'], doing: ['a', 'd'], done: [] })
    expect(findCard(preview, 'a')?.column_id).toBe('doing')
    expect(layout(board)).toEqual({ todo: ['a', 'b', 'c'], doing: ['d'], done: [] })
  })

  it("puts it behind the card it's over once past that card's middle", () => {
    expect(layout(previewCardOver(makeBoard(), 'd', 'card:a', true)).todo).toEqual(['a', 'd', 'b', 'c'])
  })

  it("puts it at the bottom over a column's empty space", () => {
    expect(layout(previewCardOver(makeBoard(), 'd', 'lane:todo', false)).todo).toEqual(['a', 'b', 'c', 'd'])
    expect(layout(previewCardOver(makeBoard(), 'a', 'lane:done', true)).done).toEqual(['a'])
  })

  it('leaves the board as it is within the card’s own column', () => {
    const board = makeBoard()
    expect(previewCardOver(board, 'a', 'card:c', true)).toBe(board)
    expect(previewCardOver(board, 'a', 'lane:todo', false)).toBe(board)
  })

  it('leaves the board as it is for a card or a target it does not have', () => {
    const board = makeBoard()
    expect(previewCardOver(board, 'gone', 'card:d', false)).toBe(board)
    expect(previewCardOver(board, null, 'lane:done', false)).toBe(board)
    expect(previewCardOver(board, 'a', 'card:gone', false)).toBe(board)
    expect(previewCardOver(board, 'a', 'lane:gone', false)).toBe(board)
  })
})

describe('resolveCardDrop', () => {
  it('takes the place of the card it is dropped on, within a column', () => {
    const board = makeBoard()
    expect(resolveCardDrop(board, board, 'a', 'card:c')).toEqual({ columnId: 'todo', index: 2 })
    expect(resolveCardDrop(board, board, 'a', 'card:b')).toEqual({ columnId: 'todo', index: 1 })
    expect(resolveCardDrop(board, board, 'c', 'card:a')).toEqual({ columnId: 'todo', index: 0 })
  })

  it('lands in the column the preview moved it into', () => {
    const board = makeBoard()
    const preview = previewCardOver(board, 'a', 'card:d', true)
    expect(resolveCardDrop(board, preview, 'a', 'card:d')).toEqual({ columnId: 'doing', index: 0 })
    expect(resolveCardDrop(board, preview, 'a', 'card:a')).toEqual({ columnId: 'doing', index: 1 })
  })

  it('stays where the preview has it when let go over anything else', () => {
    const board = makeBoard()
    const preview = previewCardOver(board, 'a', 'card:d', false)
    expect(resolveCardDrop(board, preview, 'a', null)).toEqual({ columnId: 'doing', index: 0 })
    expect(resolveCardDrop(board, preview, 'a', 'lane:doing')).toEqual({ columnId: 'doing', index: 0 })
    expect(resolveCardDrop(board, preview, 'a', 'card:b')).toEqual({ columnId: 'doing', index: 0 })
  })

  it('is null when that is where it started', () => {
    const board = makeBoard()
    expect(resolveCardDrop(board, board, 'a', 'card:a')).toBeNull()
    expect(resolveCardDrop(board, board, 'b', null)).toBeNull()
    expect(resolveCardDrop(board, board, 'd', 'lane:doing')).toBeNull()
  })

  it('places a card the board no longer has, without assuming where it was', () => {
    const preview = makeBoard()
    const board = { ...preview, columns: preview.columns.map((column) => ({ ...column, cards: [] })) }
    expect(resolveCardDrop(board, preview, 'a', null)).toEqual({ columnId: 'todo', index: 0 })
  })

  it('is null for a card the preview does not have', () => {
    expect(resolveCardDrop(makeBoard(), makeBoard(), 'gone', 'card:a')).toBeNull()
  })

  it('agrees with moveCardLocally on where the card ends up', () => {
    const board = makeBoard()
    const placement = resolveCardDrop(board, board, 'a', 'card:c')!
    expect(layout(moveCardLocally(board, 'a', placement)).todo).toEqual(['b', 'c', 'a'])
  })
})

const order = (board: ReturnType<typeof makeBoard>) => board.columns.map((column) => column.id)

describe('moveColumnLocally', () => {
  it('moves a column to the index and renumbers every column, cards and all', () => {
    const board = makeBoard()
    const moved = moveColumnLocally(board, 'todo', 2)
    expect(order(moved)).toEqual(['doing', 'done', 'todo'])
    expect(moved.columns.map((column) => column.position)).toEqual([0, 1, 2])
    expect(layout(moved)).toEqual(layout(board))
    expect(moved.id).toBe('b1')
    expect(order(board)).toEqual(['todo', 'doing', 'done'])
  })

  it('moves a column back toward the start', () => {
    expect(order(moveColumnLocally(makeBoard(), 'done', 0))).toEqual(['done', 'todo', 'doing'])
  })

  it('leaves the board alone for a column it does not have', () => {
    const board = makeBoard()
    expect(moveColumnLocally(board, 'gone', 0)).toBe(board)
  })
})

describe('resolveColumnDrop', () => {
  it('takes the place of the column it is dropped on, either way', () => {
    expect(resolveColumnDrop(makeBoard(), 'todo', 'lane:done')).toBe(2)
    expect(resolveColumnDrop(makeBoard(), 'todo', 'lane:doing')).toBe(1)
    expect(resolveColumnDrop(makeBoard(), 'done', 'lane:todo')).toBe(0)
  })

  it('is null dropped on itself, on nothing, or on something that is not a column on the board', () => {
    expect(resolveColumnDrop(makeBoard(), 'doing', null)).toBeNull()
    expect(resolveColumnDrop(makeBoard(), 'doing', 'lane:doing')).toBeNull()
    expect(resolveColumnDrop(makeBoard(), 'doing', 'lane:gone')).toBeNull()
    expect(resolveColumnDrop(makeBoard(), 'doing', 'card:a')).toBeNull()
  })

  it('agrees with moveColumnLocally on where the column ends up', () => {
    const board = makeBoard()
    expect(order(moveColumnLocally(board, 'todo', resolveColumnDrop(board, 'todo', 'lane:doing')!))).toEqual([
      'doing',
      'todo',
      'done',
    ])
  })
})

describe('board updates', () => {
  it('addCard appends to its own column only', () => {
    const added = addCard(makeBoard(), card('e', 'doing', 1))
    expect(layout(added)).toEqual({ todo: ['a', 'b', 'c'], doing: ['d', 'e'], done: [] })
  })

  it('replaceCard swaps the card with the same id in its column', () => {
    const replaced = replaceCard(makeBoard(), card('b', 'todo', 1, { title: 'Renamed' }))
    expect(findCard(replaced, 'b')?.title).toBe('Renamed')
    expect(findCard(replaced, 'a')?.title).toBe('A')
    expect(layout(replaced)).toEqual(layout(makeBoard()))
  })

  it('removeCard drops the card and renumbers what is left', () => {
    const removed = removeCard(makeBoard(), 'a')
    expect(layout(removed)).toEqual({ todo: ['b', 'c'], doing: ['d'], done: [] })
    expect(removed.columns[0].cards.map((each) => each.position)).toEqual([0, 1])
  })

  it('addColumn appends the column', () => {
    const added = addColumn(makeBoard(), { id: 'later', name: 'Later', position: 3, cards: [] })
    expect(added.columns.map((column) => column.id)).toEqual(['todo', 'doing', 'done', 'later'])
  })

  it('removeColumn drops the column and renumbers the rest', () => {
    const removed = removeColumn(makeBoard(), 'todo')
    expect(removed.columns.map((column) => [column.id, column.position])).toEqual([
      ['doing', 0],
      ['done', 1],
    ])
    expect(removed.name).toBe('My board')
  })
})

describe('label updates', () => {
  it('addLabel appends to the board list', () => {
    const label = { id: 'l-new', name: 'New', color: 'sky' as const }
    expect(addLabel(makeLabelledBoard(), label).labels).toEqual([...LABELS, label])
  })

  it('replaceLabel swaps the label with the same id only', () => {
    const renamed = { id: 'l-home', name: 'House', color: 'brown' as const }
    expect(replaceLabel(makeLabelledBoard(), renamed).labels).toEqual([LABELS[0], renamed, LABELS[2]])
  })

  it('removeLabel takes it off the board and off every card, leaving the rest', () => {
    const board = removeLabel(makeLabelledBoard(), 'l-errand')
    expect(board.labels).toEqual([LABELS[0], LABELS[1]])
    expect(findCard(board, 'a')!.labels).toEqual(['l-urgent'])
    expect(findCard(board, 'b')!.labels).toEqual(['l-home'])
    expect(findCard(board, 'd')!.labels).toEqual([])
    expect(layout(board)).toEqual(layout(makeLabelledBoard()))
  })
})
