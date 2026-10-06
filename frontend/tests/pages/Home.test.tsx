import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/api/client'
import * as endpoints from '../../src/api/endpoints'
import { rememberLastBoard } from '../../src/lib/lastBoard'
import Home from '../../src/pages/Home'

vi.mock('../../src/api/endpoints')

function Where() {
  return <p>at {useLocation().pathname}</p>
}

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

const BOARDS = [
  { id: 'b1', name: 'First' },
  { id: 'b2', name: 'Second' },
]

beforeEach(() => {
  vi.mocked(endpoints.fetchBoards).mockReset().mockResolvedValue(BOARDS)
})

describe('Home', () => {
  it('shows a loader, then opens the first board', async () => {
    renderHome()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(await screen.findByText('at /boards/b1')).toBeInTheDocument()
  })

  it('opens the board you were last on', async () => {
    rememberLastBoard('b2')
    renderHome()
    expect(await screen.findByText('at /boards/b2')).toBeInTheDocument()
  })

  it('falls back to the first board when the last one is gone', async () => {
    rememberLastBoard('deleted')
    renderHome()
    expect(await screen.findByText('at /boards/b1')).toBeInTheDocument()
  })

  it('goes to the board list when there are no boards', async () => {
    vi.mocked(endpoints.fetchBoards).mockResolvedValue([])
    renderHome()
    expect(await screen.findByText('at /boards')).toBeInTheDocument()
  })

  it('shows the error and tries again on request', async () => {
    vi.mocked(endpoints.fetchBoards).mockRejectedValueOnce(new ApiError('Nope.', 500))
    renderHome()
    expect(await screen.findByText('Nope.')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('at /boards/b1')).toBeInTheDocument()
    expect(endpoints.fetchBoards).toHaveBeenCalledTimes(2)
  })

  it('shows the loader again while retrying', async () => {
    vi.mocked(endpoints.fetchBoards)
      .mockRejectedValueOnce(new ApiError('Nope.', 500))
      .mockReturnValueOnce(new Promise(() => {}))
    renderHome()
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Nope.')).toBeNull()
  })
})
