import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'

import {
  addCard,
  addColumn,
  cardTarget,
  columnTarget,
  findCard,
  moveCardLocally,
  removeCard,
  removeColumn,
  replaceCard,
  resolveDrop,
} from '../../src/lib/board'
import { card, layout, makeBoard } from '../testUtils/fixtures'

describe('targets', () => {
  it('namespaces card and column ids', () => {
    expect(cardTarget('x')).toBe('card:x')
    expect(columnTarget('x')).toBe('column:x')
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

describe('resolveDrop', () => {
  it('takes the place of the card it is dropped on, within a column', () => {
    expect(resolveDrop(makeBoard(), 'a', 'card:c')).toEqual({ columnId: 'todo', index: 2 })
    expect(resolveDrop(makeBoard(), 'a', 'card:b')).toEqual({ columnId: 'todo', index: 1 })
    expect(resolveDrop(makeBoard(), 'c', 'card:a')).toEqual({ columnId: 'todo', index: 0 })
  })

  it('goes before the card it is dropped on, in another column', () => {
    expect(resolveDrop(makeBoard(), 'b', 'card:d')).toEqual({ columnId: 'doing', index: 0 })
  })

  it('goes to the bottom of a column dropped on directly', () => {
    expect(resolveDrop(makeBoard(), 'a', 'column:doing')).toEqual({ columnId: 'doing', index: 1 })
    expect(resolveDrop(makeBoard(), 'a', 'column:done')).toEqual({ columnId: 'done', index: 0 })
    expect(resolveDrop(makeBoard(), 'a', 'column:todo')).toEqual({ columnId: 'todo', index: 2 })
  })

  it('is null when nothing would change', () => {
    expect(resolveDrop(makeBoard(), 'a', 'card:a')).toBeNull()
    expect(resolveDrop(makeBoard(), 'c', 'column:todo')).toBeNull()
    expect(resolveDrop(makeBoard(), 'd', 'column:doing')).toBeNull()
  })

  it('is null for a target that is no longer on the board', () => {
    expect(resolveDrop(makeBoard(), 'a', 'column:gone')).toBeNull()
    expect(resolveDrop(makeBoard(), 'a', 'card:gone')).toBeNull()
  })

  it('places a card the board does not have yet, without assuming it', () => {
    expect(resolveDrop(makeBoard(), 'ghost', 'column:todo')).toEqual({ columnId: 'todo', index: 3 })
  })

  it('reads ids that themselves contain a colon', () => {
    const board = makeBoard()
    board.columns[2].id = 'x:y'
    expect(resolveDrop(board, 'a', 'column:x:y')).toEqual({ columnId: 'x:y', index: 0 })
  })

  it('agrees with moveCardLocally on where the card ends up', () => {
    const board = makeBoard()
    const placement = resolveDrop(board, 'a', 'card:c')!
    expect(layout(moveCardLocally(board, 'a', placement)).todo).toEqual(['b', 'c', 'a'])
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
