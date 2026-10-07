import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/api/client'
import * as endpoints from '../../src/api/endpoints'
import { useBoard } from '../../src/hooks/useBoard'
import { findCard } from '../../src/lib/board'
import { LABELS, card, layout, makeBoard, makeLabelledBoard } from '../testUtils/fixtures'

vi.mock('../../src/api/endpoints')

beforeEach(() => {
  vi.mocked(endpoints.fetchBoard).mockReset().mockResolvedValue(makeBoard())
})

async function loaded() {
  const hook = renderHook(({ boardId }) => useBoard(boardId), { initialProps: { boardId: 'b1' } })
  await waitFor(() => expect(hook.result.current.board).not.toBeNull())
  return hook
}

describe('useBoard loading', () => {
  it('loads the board by id', async () => {
    const { result } = await loaded()
    expect(endpoints.fetchBoard).toHaveBeenCalledWith('b1')
    expect(layout(result.current.board!)).toEqual(layout(makeBoard()))
    expect(result.current.loadError).toBeNull()
    expect(result.current.actionError).toBeNull()
  })

  it('reports a failed load', async () => {
    vi.mocked(endpoints.fetchBoard).mockRejectedValue(new ApiError('No board found with this id.', 404))
    const { result } = renderHook(() => useBoard('gone'))
    await waitFor(() => expect(result.current.loadError).toBe('No board found with this id.'))
    expect(result.current.board).toBeNull()
  })

  it('reload fetches again and clears a previous error', async () => {
    vi.mocked(endpoints.fetchBoard).mockRejectedValueOnce(new ApiError('Nope.', 500))
    const { result } = renderHook(() => useBoard('b1'))
    await waitFor(() => expect(result.current.loadError).toBe('Nope.'))
    act(() => result.current.reload())
    expect(result.current.loadError).toBeNull()
    await waitFor(() => expect(result.current.board).not.toBeNull())
    expect(endpoints.fetchBoard).toHaveBeenCalledTimes(2)
    // and again - every reload has to re-run the load, not just the first
    act(() => result.current.reload())
    await waitFor(() => expect(endpoints.fetchBoard).toHaveBeenCalledTimes(3))
  })

  it('drops a stale response when the board changes before it arrives', async () => {
    let resolveFirst: (value: ReturnType<typeof makeBoard>) => void = () => {}
    vi.mocked(endpoints.fetchBoard)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ ...makeBoard(), id: 'b2', name: 'Second' })
    const { result, rerender } = renderHook(({ boardId }) => useBoard(boardId), { initialProps: { boardId: 'b1' } })
    rerender({ boardId: 'b2' })
    await waitFor(() => expect(result.current.board?.name).toBe('Second'))
    await act(async () => resolveFirst({ ...makeBoard(), name: 'Stale' }))
    expect(result.current.board?.name).toBe('Second')
  })

  it('drops a stale failure too', async () => {
    let rejectFirst: (error: Error) => void = () => {}
    vi.mocked(endpoints.fetchBoard)
      .mockReturnValueOnce(new Promise((_, reject) => (rejectFirst = reject)))
      .mockResolvedValueOnce(makeBoard())
    const { result, rerender } = renderHook(({ boardId }) => useBoard(boardId), { initialProps: { boardId: 'b1' } })
    rerender({ boardId: 'b2' })
    await waitFor(() => expect(result.current.board).not.toBeNull())
    await act(async () => rejectFirst(new ApiError('Stale.', 500)))
    expect(result.current.loadError).toBeNull()
  })

  it('clears the old board while a new one loads', async () => {
    const { result, rerender } = await loaded()
    vi.mocked(endpoints.fetchBoard).mockReturnValue(new Promise(() => {}))
    rerender({ boardId: 'b2' })
    expect(result.current.board).toBeNull()
  })
})

describe('useBoard actions', () => {
  it('addCard creates the card with every field, at the bottom of its column', async () => {
    const { result } = await loaded()
    const fields = {
      title: 'New one',
      summary: 's',
      notes: 'details',
      due_at: '2026-10-07T09:00:00Z',
      reminders: [0],
      labels: [],
    }
    vi.mocked(endpoints.createCard).mockResolvedValue(card('e', 'done', 0, fields))
    let ok = false
    await act(async () => {
      ok = await result.current.actions.addCard('done', fields)
    })
    expect(ok).toBe(true)
    expect(endpoints.createCard).toHaveBeenCalledWith('done', fields)
    expect(layout(result.current.board!).done).toEqual(['e'])
  })

  it('saveCard replaces the card with what the server returned', async () => {
    const { result } = await loaded()
    const fields = {
      title: 'Renamed',
      summary: '',
      notes: 'n',
      due_at: '2026-10-07T09:00:00Z',
      reminders: [],
      labels: [],
    }
    vi.mocked(endpoints.updateCard).mockResolvedValue(card('b', 'todo', 1, fields))
    await act(async () => {
      await result.current.actions.saveCard('b', fields)
    })
    expect(endpoints.updateCard).toHaveBeenCalledWith('b', fields)
    expect(findCard(result.current.board!, 'b')).toMatchObject(fields)
  })

  it('deleteCard removes the card', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.deleteCard).mockResolvedValue(undefined)
    await act(async () => {
      await result.current.actions.deleteCard('a')
    })
    expect(endpoints.deleteCard).toHaveBeenCalledWith('a')
    expect(layout(result.current.board!).todo).toEqual(['b', 'c'])
  })

  it('moveCard moves the card before the server answers', async () => {
    const { result } = await loaded()
    let finish: () => void = () => {}
    vi.mocked(endpoints.moveCard).mockReturnValue(
      new Promise((resolve) => (finish = () => resolve(card('a', 'done', 0))))
    )
    let pending: Promise<boolean>
    act(() => {
      pending = result.current.actions.moveCard('a', { columnId: 'done', index: 0 })
    })
    expect(layout(result.current.board!).done).toEqual(['a'])
    expect(endpoints.moveCard).toHaveBeenCalledWith('a', 'done', 0)
    await act(async () => {
      finish()
      expect(await pending).toBe(true)
    })
    expect(endpoints.fetchBoard).toHaveBeenCalledTimes(1)
  })

  it('moveCard reloads the board and reports it when the server refuses', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.moveCard).mockRejectedValue(new ApiError('No column found with this id.', 404))
    let ok = true
    await act(async () => {
      ok = await result.current.actions.moveCard('a', { columnId: 'done', index: 0 })
    })
    expect(ok).toBe(false)
    expect(result.current.actionError).toBe('No column found with this id.')
    await waitFor(() => expect(endpoints.fetchBoard).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(layout(result.current.board!).done).toEqual([]))
  })

  it('addColumn appends the created column', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.createColumn).mockResolvedValue({ id: 'later', name: 'Later', position: 3, cards: [] })
    await act(async () => {
      await result.current.actions.addColumn('Later')
    })
    expect(endpoints.createColumn).toHaveBeenCalledWith('b1', 'Later')
    expect(result.current.board!.columns.map((column) => column.id)).toEqual(['todo', 'doing', 'done', 'later'])
  })

  it('renameColumn and moveColumn take the board the server returns', async () => {
    const { result } = await loaded()
    const renamed = { ...makeBoard(), name: 'From rename' }
    const moved = { ...makeBoard(), name: 'From move' }
    vi.mocked(endpoints.renameColumn).mockResolvedValue(renamed)
    vi.mocked(endpoints.moveColumn).mockResolvedValue(moved)
    await act(async () => {
      await result.current.actions.renameColumn('todo', 'Inbox')
    })
    expect(endpoints.renameColumn).toHaveBeenCalledWith('todo', 'Inbox')
    expect(result.current.board!.name).toBe('From rename')
    await act(async () => {
      await result.current.actions.moveColumn('todo', 2)
    })
    expect(endpoints.moveColumn).toHaveBeenCalledWith('todo', 2)
    expect(result.current.board!.name).toBe('From move')
  })

  it('deleteColumn removes the column', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.deleteColumn).mockResolvedValue(undefined)
    await act(async () => {
      await result.current.actions.deleteColumn('doing')
    })
    expect(endpoints.deleteColumn).toHaveBeenCalledWith('doing')
    expect(result.current.board!.columns.map((column) => column.id)).toEqual(['todo', 'done'])
  })

  it('renameBoard takes the saved name', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.renameBoard).mockResolvedValue({ id: 'b1', name: 'Home' })
    await act(async () => {
      await result.current.actions.renameBoard(' Home ')
    })
    expect(endpoints.renameBoard).toHaveBeenCalledWith('b1', ' Home ')
    expect(result.current.board!.name).toBe('Home')
    expect(layout(result.current.board!)).toEqual(layout(makeBoard()))
  })

  it('a failed action reports false and its message, and the next attempt clears it', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.deleteCard).mockRejectedValueOnce(new ApiError('No card found with this id.', 404))
    let ok = true
    await act(async () => {
      ok = await result.current.actions.deleteCard('a')
    })
    expect(ok).toBe(false)
    expect(result.current.actionError).toBe('No card found with this id.')
    expect(layout(result.current.board!).todo).toEqual(['a', 'b', 'c'])

    vi.mocked(endpoints.deleteCard).mockResolvedValue(undefined)
    await act(async () => {
      await result.current.actions.deleteCard('a')
    })
    expect(result.current.actionError).toBeNull()
  })

  it('dismissError clears the message', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.deleteColumn).mockRejectedValue(new ApiError('Nope.', 500))
    await act(async () => {
      await result.current.actions.deleteColumn('todo')
    })
    act(() => result.current.dismissError())
    expect(result.current.actionError).toBeNull()
  })

  it('an action that resolves after the board was unloaded leaves it unloaded', async () => {
    const { result, rerender } = await loaded()
    let finish: () => void = () => {}
    vi.mocked(endpoints.createCard).mockReturnValue(
      new Promise((resolve) => (finish = () => resolve(card('e', 'done', 0))))
    )
    vi.mocked(endpoints.fetchBoard).mockReturnValue(new Promise(() => {}))
    let pending: Promise<boolean>
    act(() => {
      pending = result.current.actions.addCard('done', {
        title: 'x',
        summary: '',
        notes: '',
        due_at: null,
        reminders: [],
        labels: [],
      })
    })
    rerender({ boardId: 'b2' })
    await act(async () => {
      finish()
      await pending
    })
    expect(result.current.board).toBeNull()
  })
})

describe('useBoard label actions', () => {
  beforeEach(() => {
    vi.mocked(endpoints.fetchBoard).mockResolvedValue(makeLabelledBoard())
  })

  it('addLabel creates it, adds it to the board, and hands it back', async () => {
    const { result } = await loaded()
    const label = { id: 'l-new', name: 'New', color: 'sky' as const }
    vi.mocked(endpoints.createLabel).mockResolvedValue(label)
    let created: unknown = null
    await act(async () => {
      created = await result.current.actions.addLabel('New')
    })
    expect(endpoints.createLabel).toHaveBeenCalledWith('b1', 'New', undefined)
    expect(created).toEqual(label)
    expect(result.current.board!.labels).toEqual([...LABELS, label])
  })

  it('addLabel passes a picked colour on', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.createLabel).mockResolvedValue({ id: 'l-new', name: 'New', color: 'red' })
    await act(async () => {
      await result.current.actions.addLabel('New', 'red')
    })
    expect(endpoints.createLabel).toHaveBeenCalledWith('b1', 'New', 'red')
  })

  it('addLabel hands back null, and shows why, when it failed', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.createLabel).mockRejectedValue(new ApiError('Taken.', 409))
    let created: unknown = 'not yet'
    await act(async () => {
      created = await result.current.actions.addLabel('Home')
    })
    expect(created).toBeNull()
    expect(result.current.actionError).toBe('Taken.')
    expect(result.current.board!.labels).toEqual(LABELS)
  })

  it('saveLabel replaces the label with what the server returned', async () => {
    const { result } = await loaded()
    const saved = { id: 'l-home', name: 'House', color: 'brown' as const }
    vi.mocked(endpoints.updateLabel).mockResolvedValue(saved)
    let ok = false
    await act(async () => {
      ok = await result.current.actions.saveLabel('l-home', 'House', 'brown')
    })
    expect(ok).toBe(true)
    expect(endpoints.updateLabel).toHaveBeenCalledWith('l-home', 'House', 'brown')
    expect(result.current.board!.labels[1]).toEqual(saved)
  })

  it('deleteLabel takes it off the board and its cards', async () => {
    const { result } = await loaded()
    vi.mocked(endpoints.deleteLabel).mockResolvedValue(undefined)
    let ok = false
    await act(async () => {
      ok = await result.current.actions.deleteLabel('l-errand')
    })
    expect(ok).toBe(true)
    expect(endpoints.deleteLabel).toHaveBeenCalledWith('l-errand')
    expect(result.current.board!.labels.map((label) => label.id)).toEqual(['l-urgent', 'l-home'])
    expect(findCard(result.current.board!, 'd')!.labels).toEqual([])
  })
})
