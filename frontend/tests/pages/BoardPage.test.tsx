import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBoard } from '../../src/hooks/useBoard'
import type { BoardState } from '../../src/hooks/useBoard'
import { readLastBoard } from '../../src/lib/lastBoard'
import BoardPage from '../../src/pages/BoardPage'
import { makeActions } from '../testUtils/actions'
import { card, makeBoard } from '../testUtils/fixtures'

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
    expect(screen.getByRole('button', { name: 'My board' })).toBeInTheDocument()
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

  it('renames the board', async () => {
    const state = mockBoard()
    renderPage()
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
