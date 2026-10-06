import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Card } from '../../src/api/types'
import CardEditor from '../../src/components/CardEditor'
import type { BoardActions } from '../../src/hooks/useBoard'
import { makeActions } from '../testUtils/actions'
import { card, makeBoard } from '../testUtils/fixtures'

function renderEditor(subject: Card = card('b', 'todo', 1), actions: BoardActions = makeActions()) {
  const onClose = vi.fn()
  render(<CardEditor card={subject} columns={makeBoard().columns} actions={actions} onClose={onClose} />)
  return { actions, onClose }
}

const field = (label: string) => screen.getByLabelText(label)
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('CardEditor', () => {
  it('starts from the card as it is', () => {
    renderEditor(card('b', 'todo', 1, { title: 'Pay rent', notes: 'IBAN in mail', due_at: '2026-10-07T09:30:00Z' }))
    expect(screen.getByRole('dialog', { name: 'Edit card' })).toBeInTheDocument()
    expect(field('Title')).toHaveValue('Pay rent')
    expect(field('Notes')).toHaveValue('IBAN in mail')
    expect(field('Due')).toHaveValue('2026-10-07T09:30')
    expect(field('Column')).toHaveValue('todo')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['To do', 'Doing', 'Done'])
  })

  it('starts with an empty due date, and no Clear button, for an undated card', () => {
    renderEditor()
    expect(field('Due')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Clear due date' })).toBeNull()
  })

  it('saves edited fields, with the due date as an instant, and closes', async () => {
    const { actions, onClose } = renderEditor()
    await userEvent.clear(field('Title'))
    await userEvent.type(field('Title'), '  Pay rent  ')
    await userEvent.type(field('Notes'), 'IBAN in mail')
    await userEvent.type(field('Due'), '2026-10-07T09:30')
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', {
      title: 'Pay rent',
      notes: 'IBAN in mail',
      due_at: '2026-10-07T09:30:00.000Z',
    })
    expect(actions.moveCard).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it.each([
    ['title', async () => userEvent.type(field('Title'), '!')],
    ['notes', async () => userEvent.type(field('Notes'), '!')],
    ['due date', async () => userEvent.type(field('Due'), '2026-10-07T09:30')],
  ])('saves when only the %s changed', async (_, edit) => {
    const { actions } = renderEditor()
    await edit()
    await save()
    expect(actions.saveCard).toHaveBeenCalledTimes(1)
  })

  it('clears the due date', async () => {
    const { actions } = renderEditor(card('b', 'todo', 1, { due_at: '2026-10-07T09:30:00Z' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear due date' }))
    expect(field('Due')).toHaveValue('')
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', { title: 'B', notes: '', due_at: null })
  })

  it('saving nothing changed makes no request and just closes', async () => {
    const { actions, onClose } = renderEditor(card('b', 'todo', 1, { due_at: '2026-10-07T09:30:00Z' }))
    await save()
    expect(actions.saveCard).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('moving to another column sends the card to its bottom', async () => {
    const { actions, onClose } = renderEditor()
    await userEvent.selectOptions(field('Column'), 'Doing')
    await save()
    expect(actions.saveCard).not.toHaveBeenCalled()
    expect(actions.moveCard).toHaveBeenCalledWith('b', { columnId: 'doing', index: 1 })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves fields before moving, and does not move when the save failed', async () => {
    const actions = makeActions({ saveCard: vi.fn().mockResolvedValue(false) })
    const { onClose } = renderEditor(card('b', 'todo', 1), actions)
    await userEvent.type(field('Title'), '!')
    await userEvent.selectOptions(field('Column'), 'Done')
    await save()
    expect(actions.moveCard).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('stays open when the move failed', async () => {
    const actions = makeActions({ moveCard: vi.fn().mockResolvedValue(false) })
    const { onClose } = renderEditor(card('b', 'todo', 1), actions)
    await userEvent.selectOptions(field('Column'), 'Done')
    await save()
    expect(actions.moveCard).toHaveBeenCalledWith('b', { columnId: 'done', index: 0 })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables Save while saving', async () => {
    let finish: (value: boolean) => void = () => {}
    const actions = makeActions({ saveCard: vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve))) })
    renderEditor(card('b', 'todo', 1), actions)
    await userEvent.type(field('Title'), '!')
    await save()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' }).querySelector('.btn__spinner')).not.toBeNull()
    finish(true)
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Save' }).querySelector('.btn__spinner')).toBeNull()
  })

  it('deletes the card and closes, or stays open if that failed', async () => {
    const { actions, onClose } = renderEditor()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(actions.deleteCard).toHaveBeenCalledWith('b')
    expect(onClose).toHaveBeenCalledTimes(1)

    const failing = makeActions({ deleteCard: vi.fn().mockResolvedValue(false) })
    const second = renderEditor(card('c', 'todo', 2), failing)
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1])
    expect(second.onClose).not.toHaveBeenCalled()
  })

  it('Cancel closes without saving', async () => {
    const { actions, onClose } = renderEditor()
    await userEvent.type(field('Title'), '!')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(actions.saveCard).not.toHaveBeenCalled()
  })

  it('limits and requires the title, and limits the notes', () => {
    renderEditor()
    expect(field('Title')).toBeRequired()
    expect(field('Title')).toHaveAttribute('maxlength', '200')
    expect(field('Title')).toHaveAttribute('pattern', '.*\\S.*')
    expect(field('Notes')).toHaveAttribute('maxlength', '10000')
    expect(field('Due')).toHaveAttribute('type', 'datetime-local')
  })
})
