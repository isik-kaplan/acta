import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Card, Label } from '../../src/api/types'
import CardEditor from '../../src/components/CardEditor'
import type { BoardActions } from '../../src/hooks/useBoard'
import { makeActions } from '../testUtils/actions'
import { LABELS, card, makeBoard } from '../testUtils/fixtures'

function renderEditor(
  subject: Card = card('b', 'todo', 1),
  actions: BoardActions = makeActions(),
  labels: Label[] = []
) {
  const onClose = vi.fn()
  render(
    <CardEditor
      card={subject}
      columnId={subject.column_id}
      columns={makeBoard().columns}
      labels={labels}
      actions={actions}
      onClose={onClose}
    />
  )
  return { actions, onClose }
}

function renderNew(columnId = 'doing', actions: BoardActions = makeActions(), labels: Label[] = []) {
  const onClose = vi.fn()
  const view = render(
    <CardEditor
      card={null}
      columnId={columnId}
      columns={makeBoard().columns}
      labels={labels}
      actions={actions}
      onClose={onClose}
    />
  )
  return { actions, onClose, rerender: view.rerender }
}

const field = (label: string) => screen.getByLabelText(label)
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save' }))

describe('CardEditor', () => {
  it('starts from the card as it is', () => {
    renderEditor(
      card('b', 'todo', 1, {
        title: 'Pay rent',
        summary: 'Before the 3rd',
        notes: 'IBAN in mail',
        due_at: '2026-10-07T09:30:00Z',
        reminders: [30, 1440],
        labels: [],
      })
    )
    expect(screen.getByRole('dialog', { name: 'Edit card' })).toBeInTheDocument()
    expect(field('Title')).toHaveValue('Pay rent')
    expect(field('Short description')).toHaveValue('Before the 3rd')
    expect(field('Reminder 1')).toHaveValue(30)
    expect(field('Reminder 1 unit')).toHaveValue('minutes')
    expect(field('Reminder 2')).toHaveValue(1)
    expect(field('Reminder 2 unit')).toHaveValue('days')
    expect(field('Notes')).toHaveValue('IBAN in mail')
    expect(field('Due')).toHaveValue('2026-10-07T09:30')
    expect(field('Column')).toHaveValue('todo')
    expect(
      within(field('Column'))
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['To do', 'Doing', 'Done'])
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
      summary: '',
      notes: 'IBAN in mail',
      due_at: '2026-10-07T09:30:00.000Z',
      reminders: [],
      labels: [],
    })
    expect(actions.moveCard).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it.each([
    ['title', async () => userEvent.type(field('Title'), '!')],
    ['short description', async () => userEvent.type(field('Short description'), '!')],
    ['notes', async () => userEvent.type(field('Notes'), '!')],
    ['due date', async () => userEvent.type(field('Due'), '2026-10-07T09:30')],
  ])('saves when only the %s changed', async (_, edit) => {
    const { actions } = renderEditor()
    await edit()
    await save()
    expect(actions.saveCard).toHaveBeenCalledTimes(1)
  })

  it('saves when only the reminders changed', async () => {
    const { actions } = renderEditor(card('b', 'todo', 1, { due_at: '2026-10-07T09:30:00Z', reminders: [0] }))
    await userEvent.click(screen.getByRole('button', { name: 'Add reminder' }))
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', {
      title: 'B',
      summary: '',
      notes: '',
      due_at: '2026-10-07T09:30:00.000Z',
      reminders: [0, 10],
      labels: [],
    })
  })

  it('saves the short description trimmed', async () => {
    const { actions } = renderEditor()
    await userEvent.type(field('Short description'), '  first floor  ')
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', expect.objectContaining({ summary: 'first floor' }))
  })

  it('shows reminders only once there is a due date', async () => {
    renderEditor()
    expect(screen.queryByRole('group', { name: 'Reminders' })).toBeNull()
    await userEvent.type(field('Due'), '2026-10-07T09:30')
    expect(screen.getByRole('group', { name: 'Reminders' })).toBeInTheDocument()
    expect(screen.getByText('No reminders for this card.')).toBeInTheDocument()
  })

  it('clears the due date, keeping the reminders for when it gets one again', async () => {
    const { actions } = renderEditor(card('b', 'todo', 1, { due_at: '2026-10-07T09:30:00Z', reminders: [0] }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear due date' }))
    expect(field('Due')).toHaveValue('')
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', {
      title: 'B',
      summary: '',
      notes: '',
      due_at: null,
      reminders: [0],
      labels: [],
    })
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

  it("requires a title, and limits no field's length", () => {
    renderEditor()
    expect(field('Title')).toBeRequired()
    expect(field('Title')).toHaveAttribute('pattern', '.*\\S.*')
    for (const label of ['Title', 'Short description', 'Notes']) expect(field(label)).not.toHaveAttribute('maxlength')
    expect(field('Due')).toHaveAttribute('type', 'datetime-local')
  })
})

describe('CardEditor for a new card', () => {
  it('is the same form, empty, in the column it was opened from, with the title focused', () => {
    renderNew('doing')
    expect(screen.getByRole('dialog', { name: 'New card' })).toBeInTheDocument()
    expect(field('Title')).toHaveValue('')
    expect(field('Title')).toHaveFocus()
    expect(field('Short description')).toHaveValue('')
    expect(field('Notes')).toHaveValue('')
    expect(field('Due')).toHaveValue('')
    expect(field('Column')).toHaveValue('doing')
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear due date' })).toBeNull()
  })

  it('starts with one reminder at the due time', async () => {
    renderNew('todo')
    await userEvent.type(field('Due'), '2026-10-07T09:30')
    expect(field('Reminder 1')).toHaveValue(0)
    expect(field('Reminder 1 unit')).toHaveValue('minutes')
    expect(screen.queryByLabelText('Reminder 2')).toBeNull()
  })

  it('creates the card with every field in the chosen column, then closes', async () => {
    const { actions, onClose } = renderNew('doing')
    await userEvent.type(field('Title'), '  Pay rent ')
    await userEvent.type(field('Short description'), 'Before the 3rd')
    await userEvent.type(field('Notes'), 'IBAN in mail')
    await userEvent.type(field('Due'), '2026-10-07T09:30')
    await userEvent.selectOptions(field('Reminder 1 unit'), 'hours')
    await userEvent.clear(field('Reminder 1'))
    await userEvent.type(field('Reminder 1'), '2')
    await userEvent.selectOptions(field('Column'), 'Done')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(actions.addCard).toHaveBeenCalledWith('done', {
      title: 'Pay rent',
      summary: 'Before the 3rd',
      notes: 'IBAN in mail',
      due_at: '2026-10-07T09:30:00.000Z',
      reminders: [120],
      labels: [],
    })
    expect(actions.saveCard).not.toHaveBeenCalled()
    expect(actions.moveCard).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('creates a card with just a title and no due date', async () => {
    const { actions } = renderNew('todo')
    await userEvent.type(field('Title'), 'Water plants')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(actions.addCard).toHaveBeenCalledWith('todo', {
      title: 'Water plants',
      summary: '',
      notes: '',
      due_at: null,
      reminders: [0],
      labels: [],
    })
  })

  it('stays open, spinner gone, when creating failed', async () => {
    let finish: (value: boolean) => void = () => {}
    const actions = makeActions({ addCard: vi.fn(() => new Promise<boolean>((resolve) => (finish = resolve))) })
    const { onClose } = renderNew('todo', actions)
    await userEvent.type(field('Title'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add card' }).querySelector('.btn__spinner')).not.toBeNull()
    finish(false)
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Add card' })).toBeEnabled())
    expect(screen.getByRole('button', { name: 'Add card' }).querySelector('.btn__spinner')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('CardEditor labels', () => {
  const labelled = () => card('b', 'todo', 1, { labels: ['l-errand'] })
  const toggle = (name: string) => screen.getByRole('button', { name: new RegExp(`${name}$`) })

  it("starts with the card's labels on", () => {
    renderEditor(labelled(), makeActions(), LABELS)
    expect(toggle('Errand')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle('Urgent')).toHaveAttribute('aria-pressed', 'false')
  })

  it('saves the labels picked, in the board order', async () => {
    const { actions } = renderEditor(labelled(), makeActions(), LABELS)
    await userEvent.click(toggle('Urgent'))
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', expect.objectContaining({ labels: ['l-urgent', 'l-errand'] }))
  })

  it('saves when only the labels changed, and not when they are back as they were', async () => {
    const { actions } = renderEditor(labelled(), makeActions(), LABELS)
    await userEvent.click(toggle('Errand'))
    await userEvent.click(toggle('Errand'))
    await save()
    expect(actions.saveCard).not.toHaveBeenCalled()
  })

  it('drops a label the board no longer has', async () => {
    const { actions } = renderEditor(card('b', 'todo', 1, { labels: ['l-gone', 'l-home'] }), makeActions(), LABELS)
    await save()
    expect(actions.saveCard).toHaveBeenCalledWith('b', expect.objectContaining({ labels: ['l-home'] }))
  })

  it('makes a new label on the board and puts it on the new card', async () => {
    const actions = makeActions()
    const view = renderNew('todo', actions, LABELS)
    await userEvent.type(field('Title'), 'Repot')
    await userEvent.type(screen.getByRole('textbox', { name: 'New label' }), 'Garden{Enter}')
    expect(actions.addLabel).toHaveBeenCalledWith('Garden')
    // The board passes its grown label list back down, as BoardPage does.
    view.rerender(
      <CardEditor
        card={null}
        columnId="todo"
        columns={makeBoard().columns}
        labels={[...LABELS, { id: 'new-Garden', name: 'Garden', color: 'blue' }]}
        actions={actions}
        onClose={view.onClose}
      />
    )
    expect(toggle('Garden')).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(actions.addCard).toHaveBeenCalledWith('todo', expect.objectContaining({ labels: ['new-Garden'] }))
  })
})
