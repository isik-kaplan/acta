import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/api/client'
import * as endpoints from '../../src/api/endpoints'
import Boards from '../../src/pages/Boards'

vi.mock('../../src/api/endpoints')

function Where() {
  return <p>at {useLocation().pathname}</p>
}

function renderBoards() {
  render(
    <MemoryRouter initialEntries={['/boards']}>
      <Routes>
        <Route path="/boards" element={<Boards />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

const BOARDS = [
  { id: 'b1', name: 'Home' },
  { id: 'b2', name: 'Work' },
]

const names = () => screen.getAllByRole('listitem').map((item) => within(item).getAllByRole('button')[0].textContent)

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(endpoints.fetchBoards).mockResolvedValue(BOARDS)
})

describe('Boards', () => {
  it('lists the boards, each with a way in', async () => {
    renderBoards()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    await screen.findByRole('button', { name: 'Home' })
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(document.querySelector('.banner')).toBeNull()
    expect(names()).toEqual(['Home', 'Work'])
    expect(screen.queryByText('No boards yet. Make one below.')).toBeNull()
    await userEvent.click(screen.getAllByRole('link', { name: 'Open' })[1])
    expect(screen.getByText('at /boards/b2')).toBeInTheDocument()
  })

  it('says when there are none', async () => {
    vi.mocked(endpoints.fetchBoards).mockResolvedValue([])
    renderBoards()
    expect(await screen.findByText('No boards yet. Make one below.')).toBeInTheDocument()
  })

  it('shows a load error instead of the loader', async () => {
    vi.mocked(endpoints.fetchBoards).mockRejectedValue(new ApiError('Nope.', 500))
    renderBoards()
    expect(await screen.findByText('Nope.')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add a board' })).toBeNull()
  })

  it('creates a board and opens it', async () => {
    vi.mocked(endpoints.createBoard).mockResolvedValue({ id: 'b3', name: 'Garden' })
    renderBoards()
    await userEvent.click(await screen.findByRole('button', { name: 'Add a board' }))
    const field = screen.getByRole('textbox', { name: 'New board' })
    expect(field).toHaveAttribute('placeholder', 'Board name')
    expect(field).toHaveAttribute('maxlength', '120')
    await userEvent.type(field, 'Garden{Enter}')
    expect(endpoints.createBoard).toHaveBeenCalledWith('Garden')
    expect(await screen.findByText('at /boards/b3')).toBeInTheDocument()
  })

  it('shows why creating failed and stays', async () => {
    vi.mocked(endpoints.createBoard).mockRejectedValue(new ApiError('Nope.', 400))
    renderBoards()
    await userEvent.click(await screen.findByRole('button', { name: 'Add a board' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'New board' }), 'Garden{Enter}')
    expect(await screen.findByText('Nope.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'New board' })).toHaveValue('Garden')
  })

  it('renames a board in place', async () => {
    vi.mocked(endpoints.renameBoard).mockResolvedValue({ id: 'b2', name: 'Job' })
    renderBoards()
    await userEvent.click(await screen.findByRole('button', { name: 'Work' }))
    const field = screen.getByRole('textbox', { name: 'board name' })
    await userEvent.clear(field)
    await userEvent.type(field, 'Job{Enter}')
    expect(endpoints.renameBoard).toHaveBeenCalledWith('b2', 'Job')
    expect(await screen.findByRole('button', { name: 'Job' })).toBeInTheDocument()
    expect(names()).toEqual(['Home', 'Job'])
  })

  it('asks before deleting a board, then removes it', async () => {
    vi.mocked(endpoints.deleteBoard).mockResolvedValue(undefined)
    renderBoards()
    await screen.findByRole('button', { name: 'Home' })
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    expect(screen.getByRole('dialog', { name: 'Delete "Home"?' })).toBeInTheDocument()
    expect(screen.getByText("Every column and card on it goes too. This can't be undone.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Delete board' }))
    expect(endpoints.deleteBoard).toHaveBeenCalledWith('b1')
    expect(screen.queryByRole('dialog')).toBeNull()
    await vi.waitFor(() => expect(names()).toEqual(['Work']))
  })

  it('keeps the board when deleting is cancelled or fails', async () => {
    vi.mocked(endpoints.deleteBoard).mockRejectedValue(new ApiError('No board found with this id.', 404))
    renderBoards()
    await screen.findByRole('button', { name: 'Home' })
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(endpoints.deleteBoard).not.toHaveBeenCalled()

    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Delete board' }))
    expect(await screen.findByText('No board found with this id.')).toBeInTheDocument()
    expect(names()).toEqual(['Home', 'Work'])
  })

  it('a successful action clears the previous error', async () => {
    vi.mocked(endpoints.renameBoard)
      .mockRejectedValueOnce(new ApiError('Nope.', 500))
      .mockResolvedValueOnce({ id: 'b1', name: 'House' })
    renderBoards()
    await userEvent.click(await screen.findByRole('button', { name: 'Home' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'board name' }), '!{Enter}')
    expect(await screen.findByText('Nope.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'board name' }), '?{Enter}')
    await screen.findByRole('button', { name: 'House' })
    expect(screen.queryByText('Nope.')).toBeNull()
  })
})
