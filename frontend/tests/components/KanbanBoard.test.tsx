import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import KanbanBoard, { pickTarget } from '../../src/components/KanbanBoard'
import type { FilterMatch } from '../../src/lib/labels'
import { makeActions } from '../testUtils/actions'
import { drag, hold, layOutBoard, moveTo, release, touchDrag } from '../testUtils/dragAndDrop'
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
  layOutBoard()
  return { ...view, actions, onOpenCard, onAddCard }
}

// By id, not text: mid-drag the lifted copy shows the same title. Fixture titles are the ids, upper-cased.
const tile = (title: string) => document.querySelector<HTMLElement>(`[data-card-id="${title.toLowerCase()}"]`)!
const lane = (name: string) => screen.getByRole('region', { name })
const grip = (name: string) => lane(name).querySelector('.lane__grip')!
// The cards a lane holds right now, in order - mid-drag too, as the preview has them.
const cardsIn = (name: string) =>
  [...lane(name).querySelectorAll('[data-card-id]')].map((item) => item.getAttribute('data-card-id'))
const point = (clientX: number, clientY: number) => ({ clientX, clientY })

// Lanes sit 300px apart and cards 60px apart below a 40px header (testUtils/dragAndDrop), so
// To do's cards a, b, c are centred at y 65, 125, 185, and Doing's d at (440, 65).

afterEach(() => {
  vi.restoreAllMocks()
})

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

  it("previews a card over another column's card in that card's place, and drops it there", async () => {
    const { actions } = renderBoard()
    hold(tile('A'), point(440, 60))
    expect(cardsIn('Doing')).toEqual(['a', 'd'])
    expect(cardsIn('To do')).toEqual(['b', 'c'])
    expect(lane('Doing').querySelector('[data-card-id="a"]')).toHaveAttribute('class', 'card-tile is-dragging')
    expect(actions.moveCard).not.toHaveBeenCalled()
    await release(point(440, 60))
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'doing', index: 0 })
  })

  it("previews a card over a column's empty space after the nearest card, and drops it there", async () => {
    const { actions } = renderBoard()
    hold(tile('B'), point(440, 300))
    expect(cardsIn('Doing')).toEqual(['d', 'b'])
    await release(point(440, 300))
    expect(actions.moveCard).toHaveBeenCalledWith('b', { columnId: 'doing', index: 1 })
  })

  it('previews a card over an empty column in it, and drops it there', async () => {
    const { actions } = renderBoard()
    hold(tile('B'), point(740, 400))
    expect(cardsIn('Done')).toEqual(['b'])
    await release(point(740, 400))
    expect(actions.moveCard).toHaveBeenCalledWith('b', { columnId: 'done', index: 0 })
  })

  it('within a column, shifts the cards aside to show the gap, and drops it there', async () => {
    const { actions } = renderBoard()
    hold(tile('A'), tile('C'))
    expect(cardsIn('To do')).toEqual(['a', 'b', 'c'])
    expect(tile('A')).toHaveAttribute('class', 'card-tile is-dragging')
    expect(tile('A').style.transform).toBe('translate3d(0px, 120px, 0)')
    expect(tile('B').style.transform).toBe('translate3d(0px, -60px, 0)')
    expect(tile('C').style.transform).toBe('translate3d(0px, -60px, 0)')
    await release(point(140, 185))
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'todo', index: 2 })
    expect(tile('A').style.transform).toBe('')
  })

  it('takes a card let go below a short column as dropped in it', async () => {
    const { actions } = renderBoard()
    hold(tile('B'), point(740, 700))
    expect(cardsIn('Done')).toEqual(['b'])
    await release(point(740, 700))
    expect(actions.moveCard).toHaveBeenCalledWith('b', { columnId: 'done', index: 0 })
  })

  it('lands a card where its stand-in is when let go over nothing', async () => {
    const { actions } = renderBoard()
    hold(tile('A'), point(440, 60))
    moveTo(point(2000, 2000))
    expect(cardsIn('Doing')).toEqual(['a', 'd'])
    await release(point(2000, 2000))
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'doing', index: 0 })
  })

  it('drags on touch only after a short hold, so a quick swipe still scrolls', async () => {
    const { actions } = renderBoard()
    await touchDrag(tile('A'), point(440, 60), 0)
    expect(actions.moveCard).not.toHaveBeenCalled()
    await touchDrag(tile('A'), point(440, 60), 250)
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'doing', index: 0 })
  })

  it('does nothing for a drop that changes nothing', async () => {
    const { actions } = renderBoard()
    await drag(tile('A'), tile('A'))
    await drag(tile('C'), point(140, 500))
    await drag(tile('A'), point(2000, 2000))
    expect(actions.moveCard).not.toHaveBeenCalled()
  })

  it('lifts a copy of the card while dragging', async () => {
    renderBoard()
    const source = tile('A')
    expect(source).toHaveAttribute('class', 'card-tile')
    hold(source, tile('B'))
    expect(source).toHaveAttribute('class', 'card-tile is-dragging')
    expect(document.querySelector('.card-tile--lifted')).toHaveTextContent(/^A$/)
    expect(document.querySelector('.lane--lifted')).toBeNull()
    await release(tile('B'))
    expect(document.querySelector('.card-tile--lifted')).toBeNull()
    expect(source).toHaveAttribute('class', 'card-tile')
  })

  it('puts the card back and drops nothing when the drag is cancelled', async () => {
    const { actions } = renderBoard()
    hold(tile('A'), point(440, 60))
    expect(cardsIn('Doing')).toEqual(['a', 'd'])
    await userEvent.keyboard('{Escape}')
    expect(document.querySelector('.card-tile--lifted')).toBeNull()
    expect(cardsIn('To do')).toEqual(['a', 'b', 'c'])
    expect(cardsIn('Doing')).toEqual(['d'])
    expect(actions.moveCard).not.toHaveBeenCalled()
  })

  it('shows the board it is given again once a drag ends', async () => {
    const { rerender, actions } = renderBoard()
    await drag(tile('A'), point(440, 60))
    expect(actions.moveCard).toHaveBeenCalledTimes(1)
    // The parent hasn't applied the move here, so the card is back where the board has it.
    expect(cardsIn('To do')).toEqual(['a', 'b', 'c'])
    rerender(
      <KanbanBoard
        board={{ ...makeBoard(), name: 'Renamed' }}
        isEditing
        filter={{ labels: [], match: 'any' }}
        now={NOW}
        actions={actions}
        onOpenCard={vi.fn()}
        onAddCard={vi.fn()}
      />
    )
    expect(cardsIn('Doing')).toEqual(['d'])
  })

  it('moves a column dropped on another into its place, by its grip', async () => {
    const { actions } = renderBoard()
    await drag(grip('To do'), point(740, 300))
    expect(actions.moveColumn).toHaveBeenCalledWith('todo', 2)
    expect(actions.moveCard).not.toHaveBeenCalled()
  })

  it("moves a column dropped on another's cards into that column's place", async () => {
    const { actions } = renderBoard()
    await drag(grip('Done'), tile('A'))
    expect(actions.moveColumn).toHaveBeenCalledWith('done', 0)
  })

  it('moves a column let go past the last one to the end', async () => {
    const { actions } = renderBoard()
    await drag(grip('To do'), point(2000, 300))
    expect(actions.moveColumn).toHaveBeenCalledWith('todo', 2)
  })

  it('drags a column on touch too', async () => {
    const { actions } = renderBoard()
    await touchDrag(grip('Doing'), point(140, 300), 250)
    expect(actions.moveColumn).toHaveBeenCalledWith('doing', 0)
  })

  it('does nothing for a column dropped on itself', async () => {
    const { actions } = renderBoard()
    await drag(grip('Doing'), point(440, 300))
    expect(actions.moveColumn).not.toHaveBeenCalled()
  })

  it('lifts a copy of the column with its shown cards, and shifts the others aside', async () => {
    renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard(), filter: ['l-errand'] })
    hold(grip('To do'), point(740, 300))
    expect(lane('To do')).toHaveAttribute('class', 'lane is-dragging')
    expect(lane('To do').style.transform).toBe('translate3d(600px, 0px, 0)')
    expect(lane('Doing')).toHaveAttribute('class', 'lane')
    expect(lane('Doing').style.transform).toBe('translate3d(-300px, 0px, 0)')
    expect(lane('Done').style.transform).toBe('translate3d(-300px, 0px, 0)')
    // The original tile, not its copy in the lifted column - a card in a dragged column isn't dragged itself.
    expect(lane('To do').querySelector('[data-card-id="b"]')).toHaveAttribute('class', 'card-tile')
    const lifted = document.querySelector('.lane--lifted')!
    expect(lifted).toHaveAttribute('class', 'lane lane--lifted')
    expect(lifted.querySelector('.lane__header > .lane__name')).toHaveTextContent(/^To do$/)
    expect(
      [...lifted.querySelectorAll('ol.lane__cards > li.card-tile > .card-tile__open')].map((each) => each.textContent)
    ).toEqual(['BHomeErrand'])
    expect(document.querySelector('.card-tile--lifted')).toBeNull()
    await release(point(740, 300))
    expect(document.querySelector('.lane--lifted')).toBeNull()
    expect(lane('To do')).toHaveAttribute('class', 'lane')
  })

  it('lets a column be dragged only in edit mode, while cards drag in either', async () => {
    const { actions } = renderBoard(makeActions(), vi.fn(), { isEditing: false })
    expect(document.querySelector('.lane__grip')).toBeNull()
    await drag(tile('A'), point(440, 60))
    expect(actions.moveCard).toHaveBeenCalledWith('a', { columnId: 'doing', index: 0 })
  })
})

describe('pickTarget', () => {
  const rect = (left: number) => ({ left, top: 0, right: left + 10, bottom: 10, width: 10, height: 10 })
  // Each id's box sits 100px right of the one before; `inLane` says which lane a card's sortable belongs to.
  const args = (
    ids: string[],
    {
      pointer = null as { x: number; y: number } | null,
      active = 'card:x',
      at = 0,
      inLane = {} as Record<string, string>,
    } = {}
  ) =>
    ({
      active: { id: active },
      collisionRect: rect(at),
      droppableRects: new Map(ids.map((id, index) => [id, rect(index * 100)])),
      droppableContainers: ids.map((id) => ({
        id,
        data: { current: id in inLane ? { sortable: { containerId: inLane[id] } } : undefined },
      })),
      pointerCoordinates: pointer,
    }) as unknown as Parameters<typeof pickTarget>[0]
  const ids = (hits: { id: unknown }[]) => hits.map((hit) => hit.id)

  it('picks the card under the pointer over the lane around it', () => {
    const both = args(['lane:todo', 'card:a'], { pointer: { x: 5, y: 5 } })
    ;(both.droppableRects as Map<string, unknown>).set('card:a', rect(0))
    expect(ids(pickTarget(both))).toEqual(['card:a'])
  })

  it("over a lane's empty space, picks the nearest of that lane's own cards", () => {
    const inLane = { 'card:a': 'lane:todo', 'card:b': 'lane:todo', 'card:z': 'lane:doing' }
    const hits = pickTarget(
      args(['lane:todo', 'card:a', 'card:b', 'card:z'], { pointer: { x: 5, y: 5 }, at: 290, inLane })
    )
    expect(ids(hits)).toEqual(['card:b', 'card:a'])
  })

  it('picks a lane with no cards of its own itself', () => {
    const hits = pickTarget(args(['lane:todo', 'lane:doing', 'card:z'], { pointer: { x: 105, y: 5 } }))
    expect(ids(hits)).toEqual(['lane:doing'])
  })

  it('picks the lane above or below the pointer, edges included', () => {
    for (const x of [100, 105, 110]) {
      expect(ids(pickTarget(args(['lane:todo', 'lane:doing', 'card:z'], { pointer: { x, y: 500 } })))).toEqual([
        'lane:doing',
      ])
    }
  })

  it('picks nothing for a card with no lane in line with the pointer, even what the copy overlaps', () => {
    expect(pickTarget(args(['lane:todo', 'card:a'], { pointer: { x: 50, y: 500 } }))).toEqual([])
    expect(pickTarget(args(['lane:todo', 'card:a'], { pointer: { x: 105, y: 500 } }))).toEqual([])
    expect(pickTarget(args(['lane:todo', 'lane:doing'], { pointer: { x: 99, y: 500 } }))).toEqual([])
    expect(pickTarget(args(['lane:todo', 'lane:doing'], { pointer: { x: 111, y: 500 } }))).toEqual([])
  })

  it('passes over a lane not measured yet', () => {
    const unmeasured = args(['lane:todo', 'lane:doing'], { pointer: { x: 105, y: 500 } })
    ;(unmeasured.droppableRects as Map<string, unknown>).delete('lane:todo')
    expect(ids(pickTarget(unmeasured))).toEqual(['lane:doing'])
  })

  it('picks nothing without a pointer to go by', () => {
    expect(pickTarget(args(['lane:todo'], { pointer: null }))).toEqual([])
  })

  it('for a dragged column, picks the nearest column and never a card', () => {
    const hits = pickTarget(args(['card:a', 'lane:todo', 'lane:doing'], { active: 'lane:done', at: 0 }))
    expect(ids(hits)).toEqual(['lane:todo', 'lane:doing'])
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

  it("places a dragged card right after the shown card it's nearest, among hidden ones too", async () => {
    // To do is a, b, c with only b shown: let go below b, d lands after b and before the hidden c.
    const { actions } = renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard(), filter: ['l-errand'] })
    await drag(tile('D'), point(140, 400))
    expect(actions.moveCard).toHaveBeenCalledWith('d', { columnId: 'todo', index: 2 })
  })

  it('lifts a labelled card with its labels showing', async () => {
    renderBoard(makeActions(), vi.fn(), { board: makeLabelledBoard() })
    const source = tile('A')
    hold(source, tile('B'))
    expect(document.querySelector('.card-tile--lifted')).toHaveTextContent(/^AUrgent$/)
    await release(source)
  })
})
