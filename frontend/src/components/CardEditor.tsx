import { useState } from 'react'
import type { FormEvent } from 'react'

import { useFormState } from '@isik-kaplan/core/hooks'

import type { Card, Column } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { fromLocalInput, toLocalInput } from '../lib/due'
import Dialog from './Dialog'

interface CardEditorProps {
  card: Card
  columns: Column[]
  actions: BoardActions
  onClose: () => void
}

export default function CardEditor({ card, columns, actions, onClose }: CardEditorProps) {
  const { formState, handleFormStateEvent, handleFormStateOnClick } = useFormState({
    title: card.title,
    notes: card.notes,
    due: card.due_at ? toLocalInput(card.due_at) : '',
    columnId: card.column_id,
  })
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setIsSaving(true)
    const fields = { title: formState.title.trim(), notes: formState.notes, due_at: fromLocalInput(formState.due) }
    const changed =
      fields.title !== card.title ||
      fields.notes !== card.notes ||
      formState.due !== (card.due_at ? toLocalInput(card.due_at) : '')
    let saved = !changed || (await actions.saveCard(card.id, fields))
    if (saved && formState.columnId !== card.column_id) {
      const target = columns.find((column) => column.id === formState.columnId)!
      // Moving from here sends it to the bottom of the new column, like a drop on its empty space.
      saved = await actions.moveCard(card.id, { columnId: target.id, index: target.cards.length })
    }
    setIsSaving(false)
    if (saved) onClose()
  }

  async function handleDelete() {
    if (await actions.deleteCard(card.id)) onClose()
  }

  return (
    <Dialog title="Edit card" onClose={onClose}>
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="card-title">Title</label>
          <input
            id="card-title"
            className="input"
            required
            maxLength={200}
            pattern=".*\S.*"
            value={formState.title}
            onChange={handleFormStateEvent('title')}
          />
        </div>
        <div className="field">
          <label htmlFor="card-notes">Notes</label>
          <textarea
            id="card-notes"
            className="input input--area"
            rows={4}
            maxLength={10000}
            value={formState.notes}
            onChange={handleFormStateEvent('notes')}
          />
        </div>
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
            <span className="field__hint">You'll get a notification at this time.</span>
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
        <div className="dialog__actions">
          <button type="submit" className="btn btn--primary" disabled={isSaving}>
            {isSaving && <span className="btn__spinner" aria-hidden="true" />}
            Save
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--danger dialog__push" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </form>
    </Dialog>
  )
}
