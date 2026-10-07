import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import KanbanBoard, { preferCards } from '../../src/components/KanbanBoard'
import type { FilterMatch } from '../../src/lib/labels'
import { makeActions } from '../testUtils/actions'
import { drag, hold, layOutBoard, release, touchDrag } from '../testUtils/dragAndDrop'
import { makeBoard, makeLabelledBoard } from '../testUtils/fixtures'

const NOW = new Date('2026-10-06T12:00:00Z')

function renderBoard(
  actions = makeActions(),
  onOpenCard = vi.fn(),
  { isEditing = true, board = makeBoard(), filter = [] as string[], match = 'any' as FilterMatch } = {}
) {
  const onAddCard = vi.fn()
  const view = render(
    <KanbanBoard
      board={board}
      isEditing={isEditing}
      filter={{ labels: filter, match }}
      now={NOW}
      actions={actions}
      onOpenCard={onOpenCard}
      onAddCard={onAddCard}
    />
  )
  layOutBoard(view.container)
  return { ...view, actions, onOpenCard, onAddCard }
}

const tile = (title: string) => screen.getByText(title).closest('li')!
const lane = (name: string) => screen.getByRole('region', { name })

describe('KanbanBoard', () => {
  it('renders every column in order with its cards', () => {
    renderBoard()
    expect(screen.getAllByRole('region').map((each) => each.getAttribute('aria-label'))).toEqual([
      'To do',
      'Doing',
      'Done',
    ])
    expect(
      within(lane('To do'))
        .getAllByRole('listitem')
        .map((each) => each.textContent)
    ).toEqual(['A', 'B', 'C'])
  })

  it('only lets the first column move left and the last move right', async () => {
    const user = userEvent.setup()
    renderBoard()
    await user.click(screen.getByRole('button', { name: 'To do options' }))
    expect(screen.getByRole('button', { name: 'Move left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Done options' }))
    expect(screen.getByRole('button', { name: 'Move left' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Doing options' }))
    expect(screen.getByRole('button', { name: 'Move left' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeEnabled()
  })

  it('adds a column from the trailing composer', async () => {
    const user = userEvent.setup()
    const { actions } = renderBoard()
    await user.click(screen.getByRole('button', { name: 'Add a column' }))
    await user.type(screen.getByRole('textbox', { name: 'New column' }), 'Later{Enter}')
    expect(actions.addColumn).toHaveBeenCalledWith('Later')
    expect(screen.getByRole('textbox', { name: 'New column' }).tagName).toBe('INPUT')
    expect(screen.getByRole('textbox', { name: 'New column' })).not.toHaveAttribute('maxlength')
    expect(screen.getByRole('textbox', { name: 'New column' })).toHaveAttribute('placeholder', 'Column name')
  })

  it('out of edit mode, shows plain column names with no column controls', () => {
    renderBoard(makeActions(), vi.fn(), { isEditing: false })
    expect(screen.getByRole('heading', { name: 'To do' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'To do' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'To do options' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a column' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Add a card' })).toHaveLength(3)
  })

  it('offers to add a column on a board that has none, even out of edit mode', () => {
    renderBoard(makeActions(), vi.fn(), { isEditing: false, board: { ...makeBoard(), columns: [] } })
    expect(screen.getByRole('button', { name: 'Add a column' })).toBeInTheDocument()
  })

  it('asks for a new card in the column whose button was pressed', async () => {
    const { onAddCard } = renderBoard()
    await userEvent.click(within(lane('Doing')).getByRole('button', { name: 'Add a card' }))
    expect(onAddCard).toHaveBeenCalledWith('doing')
  })

  it('opens a card when clicked', async () => {
    const user = userEvent.setup()
    const { onOpenCard } = renderBoard()
    await user.click(screen.getByRole('button', { name: 'B' }))
    expect(onOpenCard).toHaveBeenCalledWith('b')
  })

  it("moves a card dropped on another card into that card's place", async () => {
    const { actions } = renderBoard()
    await drag(tile('A'), tile('D'))
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'doing', index: 0 })
  })

  it('moves a card dropped on the empty part of a column to its bottom', async () => {
    const { actions } = renderBoard()
    await drag(tile('B'), { clientX: 610, clientY: 400 })
    expect(actions.moveCard).toHaveBeenCalledWith('b', { columnId: 'done', index: 0 })
  })

  it('drags on touch only after a short hold, so a quick swipe still scrolls', async () => {
    const { actions } = renderBoard()
    await touchDrag(tile('A'), tile('D'), 0)
    expect(actions.moveCard).not.toHaveBeenCalled()
    await touchDrag(tile('A'), tile('D'), 250)
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'doing', index: 0 })
  })

  it('does nothing for a drop that changes nothing, or lands nowhere', async () => {
    const { actions } = renderBoard()
    await drag(tile('A'), tile('A'))
    await drag(tile('C'), { clientX: 140, clientY: 500 })
    await drag(tile('A'), { clientX: 2000, clientY: 2000 })
    expect(actions.moveCard).not.toHaveBeenCalled()
  })

  it('lifts a copy of the card while dragging, and marks the original and the target', async () => {
    renderBoard()
    const source = tile('A')
    expect(source).toHaveAttribute('class', 'card-tile')
    hold(source, tile('D'))
    expect(source).toHaveAttribute('class', 'card-tile is-dragging')
    expect(tile('D')).toHaveAttribute('class', 'card-tile is-over')
    const lifted = document.querySelector('.card-tile--lifted')!
    expect(lifted).toHaveTextContent('A')
    await release(tile('D'))
    expect(document.querySelector('.card-tile--lifted')).toBeNull()
    expect(source).toHaveAttribute('class', 'card-tile')
  })

  it('marks a column hovered over its empty space', async () => {
    renderBoard()
    hold(tile('A'), { clientX: 610, clientY: 400 })
    expect(lane('Done')).toHaveAttribute('class', 'lane is-over')
    expect(lane('To do')).toHaveAttribute('class', 'lane')
    await release({ clientX: 610, clientY: 400 })
  })

  it('drops nothing when the drag is cancelled', async () => {
    const { actions } = renderBoard()
    hold(tile('A'), tile('D'))
    await userEvent.keyboard('{Escape}')
    expect(document.querySelector('.card-tile--lifted')).toBeNull()
    expect(actions.moveCard).not.toHaveBeenCalled()
  })
})

describe('preferCards', () => {
  const rect = (left: number) => ({ left, top: 0, right: left + 10, bottom: 10, width: 10, height: 10 })
  const args = (ids: string[], pointer: { x: number; y: number } | null) =>
    ({
      active: { id: 'x' },
      collisionRect: rect(0),
      droppableRects: new Map(ids.map((id, index) => [id, rect(index * 100)])),
      droppableContainers: ids.map((id) => ({ id, data: { current: undefined } })),
      pointerCoordinates: pointer,
    }) as unknown as Parameters<typeof preferCards>[0]

  it('picks the card under the pointer over the column around it', () => {
    const both = args(['column:todo', 'card:a'], { x: 5, y: 5 })
    ;(both.droppableRects as Map<string, unknown>).set('card:a', rect(0))
    expect(preferCards(both).map((hit) => hit.id)).toEqual(['card:a'])
  })

  it('falls back to the column under the pointer', () => {
    expect(preferCards(args(['column:todo', 'column:doing'], { x: 105, y: 5 })).map((hit) => hit.id)).toEqual([
      'column:doing',
    ])
  })

  it('falls back to overlap when the pointer is over nothing', () => {
    expect(preferCards(args(['column:todo'], { x: 500, y: 500 })).map((hit) => hit.id)).toEqual(['column:todo'])
  })
})

describe('KanbanBoard with labels', () => {
  it('filters every lane by the same labels, and shows labels on the cards', () => {
    renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard(), filter: ['l-errand'] })
    expect(
      within(lane('To do'))
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-card-id'))
    ).toEqual(['b'])
    expect(
      within(lane('Doing'))
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-card-id'))
    ).toEqual(['d'])
    expect(within(tile('B')).getByText('Home')).toHaveClass('label-chip')
  })

  it('shows only cards with every filtered label when matching all', () => {
    renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard(), filter: ['l-home', 'l-errand'], match: 'all' })
    expect([...document.querySelectorAll('[data-card-id]')].map((item) => item.getAttribute('data-card-id'))).toEqual([
      'b',
    ])
  })

  it("places a dragged card among all of a column's cards, hidden ones too", async () => {
    const { actions } = renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard(), filter: ['l-errand'] })
    await drag(tile('D'), lane('To do'))
    expect(actions.moveCard).toHaveBeenCalledWith('d', { columnId: 'todo', index: 3 })
  })

  it('lifts a labelled card with its labels showing', async () => {
    renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard() })
    const source = tile('A')
    hold(source, tile('B'))
    expect(document.querySelector('.card-tile--lifted')).toHaveTextContent(/^AUrgent$/)
    await release(source)
  })
})
