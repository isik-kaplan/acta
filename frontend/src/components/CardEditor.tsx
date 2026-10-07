import { useState } from 'react'
import type { FormEvent } from 'react'

import { useFormState } from '@isik-kaplan/core/hooks'

import type { Card, CardFields, Column, Label } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { fromLocalInput, toLocalInput } from '../lib/due'
import type { ReminderDraft } from '../lib/reminders'
import { collectReminders, toDraft } from '../lib/reminders'
import Dialog from './Dialog'
import LabelPicker from './LabelPicker'
import ReminderList from './ReminderList'

interface CardEditorProps {
  // null for a card that doesn't exist yet: the same form, which creates it in `columnId` on save.
  card: Card | null
  columnId: string
  columns: Column[]
  labels: Label[]
  actions: BoardActions
  onClose: () => void
}

export default function CardEditor({ card, columnId, columns, labels, actions, onClose }: CardEditorProps) {
  const initialDue = card?.due_at ? toLocalInput(card.due_at) : ''
  const { formState, handleFormStateEvent, handleFormStateOnClick } = useFormState({
    title: card?.title ?? '',
    summary: card?.summary ?? '',
    notes: card?.notes ?? '',
    due: initialDue,
    columnId,
  })
  // A new card starts with one reminder at the due time - the push you get without asking.
  const [reminders, setReminders] = useState<ReminderDraft[]>(() => (card ? card.reminders : [0]).map(toDraft))
  // Stryker disable next-line ArrayDeclaration: an id no board label has is dropped on save, so a stray starting entry changes nothing
  const [selectedLabels, setSelectedLabels] = useState<string[]>(card?.labels ?? [])
  const [isSaving, setIsSaving] = useState(false)

  async function update(existing: Card, fields: CardFields): Promise<boolean> {
    const changed =
      fields.title !== existing.title ||
      fields.summary !== existing.summary ||
      fields.notes !== existing.notes ||
      formState.due !== initialDue ||
      String(fields.reminders) !== String(existing.reminders) ||
      String(fields.labels) !== String(existing.labels)
    if (changed && !(await actions.saveCard(existing.id, fields))) return false
    if (formState.columnId === existing.column_id) return true
    const target = columns.find((column) => column.id === formState.columnId)!
    // Moving from here sends it to the bottom of the new column, like a drop on its empty space.
    return actions.moveCard(existing.id, { columnId: target.id, index: target.cards.length })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    const fields = {
      title: formState.title.trim(),
      summary: formState.summary.trim(),
      notes: formState.notes,
      due_at: fromLocalInput(formState.due),
      reminders: collectReminders(reminders),
      // In the board's order, and only ones still on the board.
      labels: labels.filter((label) => selectedLabels.includes(label.id)).map((label) => label.id),
    }
    const saved = card ? await update(card, fields) : await actions.addCard(formState.columnId, fields)
    setIsSaving(false)
    if (!saved) return
    onClose()
  }

  async function handleDelete(existing: Card) {
    if (await actions.deleteCard(existing.id)) onClose()
  }

  return (
    <Dialog title={card ? 'Edit card' : 'New card'} onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="card-title">Title</label>
          <input
            id="card-title"
            className="input"
            required
            pattern=".*\S.*"
            autoFocus={!card}
            value={formState.title}
            onChange={handleFormStateEvent('title')}
          />
        </div>
        <div className="field">
          <label htmlFor="card-summary">Short description</label>
          <input
            id="card-summary"
            className="input"
            value={formState.summary}
            onChange={handleFormStateEvent('summary')}
          />
          <span className="field__hint">Shown under the title on the board.</span>
        </div>
        <div className="field">
          <label htmlFor="card-notes">Notes</label>
          <textarea
            id="card-notes"
            className="input input--area"
            rows={4}
            value={formState.notes}
            onChange={handleFormStateEvent('notes')}
          />
        </div>
        <LabelPicker
          labels={labels}
          selected={selectedLabels}
          onSelect={setSelectedLabels}
          onCreate={(name) => actions.addLabel(name)}
        />
        <div className="form__row">
          <div className="field">
            <label htmlFor="card-due">Due</label>
            <div className="field__inline">
              <input
                id="card-due"
                className="input numeral"
                type="datetime-local"
                value={formState.due}
                onChange={handleFormStateEvent('due')}
              />
              {formState.due && (
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={handleFormStateOnClick('due', '')}
                  aria-label="Clear due date"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="card-column">Column</label>
            <select
              id="card-column"
              className="select"
              value={formState.columnId}
              onChange={handleFormStateEvent('columnId')}
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {formState.due && <ReminderList drafts={reminders} onChange={setReminders} />}
        <div className="dialog__actions">
          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving && <span className="btn__spinner" aria-hidden="true" />}
            {card ? 'Save' : 'Add card'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          {card && (
            <button type="button" className="btn btn--danger dialog__push" onClick={() => handleDelete(card)}>
              Delete
            </button>
          )}
        </div>
      </form>
    </Dialog>
  )
}
