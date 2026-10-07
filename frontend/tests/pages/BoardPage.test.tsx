import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBoard } from '../../src/hooks/useBoard'
import type { BoardState } from '../../src/hooks/useBoard'
import { readLastBoard } from '../../src/lib/lastBoard'
import BoardPage from '../../src/pages/BoardPage'
import { makeActions } from '../testUtils/actions'
import { card, makeBoard, makeLabelledBoard } from '../testUtils/fixtures'

vi.mock('../../src/hooks/useBoard')

function Where() {
  const location = useLocation()
  return (
    <>
      <p data-testid="where">{location.pathname + location.search}</p>
      <Link to="/boards/b2">go to b2</Link>
    </>
  )
}

function mockBoard(overrides: Partial<BoardState> = {}): BoardState {
  const value: BoardState = {
    board: makeBoard(),
    loadError: null,
    actionError: null,
    dismissError: vi.fn(),
    reload: vi.fn(),
    actions: makeActions(),
    ...overrides,
  }
  vi.mocked(useBoard).mockReturnValue(value)
  return value
}

function renderPage(path = '/boards/b1') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/boards/:boardId"
          element={
            <>
              <BoardPage />
              <Where />
            </>
          }
        />
        <Route path="/boards" element={<p>board list</p>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(useBoard).mockReset()
})

describe('BoardPage', () => {
  it('loads the board from the url and remembers it as the last one', () => {
    mockBoard()
    renderPage('/boards/b1')
    expect(useBoard).toHaveBeenCalledWith('b1')
    expect(readLastBoard()).toBe('b1')
    expect(screen.getByRole('heading', { level: 1, name: 'My board' })).toHaveClass('board__name')
    expect(screen.queryByRole('button', { name: 'My board' })).toBeNull()
    expect(screen.getByText('4 cards')).toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(3)
  })

  it('remembers the new board when the url moves to another one', async () => {
    mockBoard()
    renderPage('/boards/b1')
    await userEvent.click(screen.getByRole('link', { name: 'go to b2' }))
    expect(useBoard).toHaveBeenLastCalledWith('b2')
    expect(readLastBoard()).toBe('b2')
  })

  it('counts one card in the singular', () => {
    const board = makeBoard()
    board.columns = [{ ...board.columns[1] }]
    mockBoard({ board })
    renderPage()
    expect(screen.getByText('1 card')).toBeInTheDocument()
  })

  it('toggles edit mode, which brings out every rename, menu and the add-column slot', async () => {
    mockBoard()
    renderPage()
    expect(screen.queryByRole('button', { name: 'Add a column' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'To do options' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('button', { name: 'My board' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add a column' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To do options' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Done editing' }))
    expect(screen.getByRole('heading', { level: 1, name: 'My board' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a column' })).toBeNull()
  })

  it('shows a loader until the board arrives', () => {
    mockBoard({ board: null })
    renderPage()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows a load error with a retry and a way out', async () => {
    const state = mockBoard({ board: null, loadError: 'No board found with this id.' })
    renderPage()
    expect(screen.getByText('No board found with this id.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state.reload).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('link', { name: 'All boards' }))
    expect(screen.getByText('board list')).toBeInTheDocument()
  })

  it('renames the board in edit mode', async () => {
    const state = mockBoard()
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.click(screen.getByRole('button', { name: 'My board' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'board name' }), '!{Enter}')
    expect(state.actions.renameBoard).toHaveBeenCalledWith('My board!')
  })

  it('shows an action error until dismissed', async () => {
    const state = mockBoard({ actionError: 'No column found with this id.' })
    renderPage()
    expect(screen.getByRole('alert')).toHaveTextContent('No column found with this id.')
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(state.dismissError).toHaveBeenCalled()
  })

  it('opens a card into the url, and closing the editor takes it out again', async () => {
    mockBoard()
    renderPage()
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/boards/b1?card=b')
    expect(screen.getByLabelText('Title')).toHaveValue('B')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1$/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Add a card opens an empty form for that column, which closes without touching the url', async () => {
    const state = mockBoard()
    renderPage()
    const doing = screen.getByRole('region', { name: 'Doing' })
    await userEvent.click(within(doing).getByRole('button', { name: 'Add a card' }))
    expect(screen.getByRole('dialog', { name: 'New card' })).toBeInTheDocument()
    expect(screen.getByLabelText('Column')).toHaveValue('doing')
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1$/)
    await userEvent.type(screen.getByLabelText('Title'), 'Water plants')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(state.actions.addCard).toHaveBeenCalledWith('doing', {
      title: 'Water plants',
      summary: '',
      notes: '',
      due_at: null,
      reminders: [0],
      labels: [],
    })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('cancelling a new card closes the form without adding anything', async () => {
    const state = mockBoard()
    renderPage()
    await userEvent.click(screen.getAllByRole('button', { name: 'Add a card' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(state.actions.addCard).not.toHaveBeenCalled()
  })

  it('opens the card a notification linked to', () => {
    mockBoard()
    renderPage('/boards/b1?card=d')
    expect(screen.getByLabelText('Title')).toHaveValue('D')
    expect(screen.getByLabelText('Column')).toHaveValue('doing')
  })

  it('ignores a card id that is not on the board', () => {
    mockBoard()
    renderPage('/boards/b1?card=gone')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('reopens the editor fresh for a different card', async () => {
    mockBoard()
    renderPage('/boards/b1?card=a')
    await userEvent.type(screen.getByLabelText('Title'), ' draft')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(screen.getByLabelText('Title')).toHaveValue('C')
  })

  it('ticks the clock so due badges stay current', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T11:59:50Z'))
    const board = makeBoard()
    board.columns[0].cards[0] = card('a', 'todo', 0, { due_at: '2026-10-06T12:00:00Z' })
    mockBoard({ board })
    renderPage()
    expect(document.querySelector('.due')).toHaveClass('due--today')
    act(() => vi.advanceTimersByTime(30_000))
    expect(document.querySelector('.due')).toHaveClass('due--overdue')
    vi.useRealTimers()
  })
})

describe('BoardPage labels', () => {
  const shown = () => [...document.querySelectorAll('[data-card-id]')].map((tile) => tile.getAttribute('data-card-id'))
  const filterToggle = (name: string) =>
    within(screen.getByRole('group', { name: 'Filter by label' })).getByRole('button', { name: new RegExp(`${name}$`) })

  it('has no filter row on a board without labels', () => {
    mockBoard()
    renderPage()
    expect(screen.queryByRole('group', { name: 'Filter by label' })).toBeNull()
  })

  it('filters the board by label, keeping the filter in the url', async () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage()
    expect(shown()).toEqual(['a', 'b', 'c', 'd'])
    await userEvent.click(filterToggle('Errand'))
    expect(screen.getByTestId('where')).toHaveTextContent('/boards/b1?labels=l-errand')
    expect(shown()).toEqual(['b', 'd'])
    await userEvent.click(filterToggle('Urgent'))
    expect(screen.getByTestId('where')).toHaveTextContent('/boards/b1?labels=l-errand%2Cl-urgent')
    expect(shown()).toEqual(['a', 'b', 'd'])
    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1$/)
    expect(shown()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('switches the filter to cards with every label, keeping that in the url', async () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-home,l-errand')
    expect(shown()).toEqual(['b', 'd'])
    await userEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1\?labels=l-home%2Cl-errand&match=all$/)
    expect(shown()).toEqual(['b'])
    await userEvent.click(screen.getByRole('button', { name: 'Any' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1\?labels=l-home%2Cl-errand$/)
    expect(shown()).toEqual(['b', 'd'])
  })

  it('reads all from the url, and treats anything else there as any', () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-home,l-errand&match=all')
    expect(shown()).toEqual(['b'])
    cleanup()
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-home,l-errand&match=both')
    expect(shown()).toEqual(['b', 'd'])
    expect(screen.getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('clears an all filter back to every card and a clean url', async () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-home,l-errand&match=all')
    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1$/)
    expect(shown()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('reads the filter from the url, ignoring labels the board no longer has', () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-gone,l-home')
    expect(shown()).toEqual(['b'])
    expect(filterToggle('Home')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows every card when only gone labels are in the url', () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-gone')
    expect(shown()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('keeps the filter while a card is opened and closed', async () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?labels=l-errand')
    await userEvent.click(screen.getByRole('button', { name: /^B/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/boards/b1?labels=l-errand&card=b')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/boards\/b1\?labels=l-errand$/)
  })

  it('gives the card editors the board labels', async () => {
    mockBoard({ board: makeLabelledBoard() })
    renderPage('/boards/b1?card=a')
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Urgent$/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await userEvent.click(
      within(screen.getByRole('region', { name: 'Done' })).getByRole('button', { name: /Add a card/ })
    )
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /Errand$/ })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('opens and closes the label manager', async () => {
    const state = mockBoard({ board: makeLabelledBoard() })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Labels' }))
    const manager = screen.getByRole('dialog', { name: 'Labels' })
    await userEvent.click(within(manager).getByRole('button', { name: 'Delete Urgent' }))
    await userEvent.click(within(manager).getByRole('button', { name: 'Delete label' }))
    expect(state.actions.deleteLabel).toHaveBeenCalledWith('l-urgent')
    await userEvent.click(within(manager).getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
