import { useState } from 'react'
import type { FormEvent } from 'react'

import type { Board, Label } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { findLabelByName } from '../lib/labels'
import ColorPicker from './ColorPicker'
import Dialog from './Dialog'
import InlineEdit from './InlineEdit'

function usage(board: Board, labelId: string): number {
  return board.columns.flatMap((column) => column.cards).filter((card) => card.labels.includes(labelId)).length
}

interface LabelRowProps {
  label: Label
  uses: number
  actions: BoardActions
}

function LabelRow({ label, uses, actions }: LabelRowProps) {
  const [isPicking, setIsPicking] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const cardsText = `${uses} ${uses === 1 ? 'card' : 'cards'}`

  function remove() {
    // An unused label goes at once; one on cards asks first, right here in its row.
    if (uses === 0) actions.deleteLabel(label.id)
    else setIsConfirming(true)
  }

  return (
    <li className="label-row">
      <div className="label-row__main">
        <button
          type="button"
          className={`label-row__color color-swatch label-color--${label.color}`}
          aria-expanded={isPicking}
          aria-label={`Colour of ${label.name}: ${label.color}`}
          onClick={() => setIsPicking(!isPicking)}
        />
        <InlineEdit
          value={label.name}
          label="label"
          className={`label-row__name label-chip label-color--${label.color}`}
          onSave={(name) => actions.saveLabel(label.id, name, label.color)}
        />
        <span className="label-row__uses numeral">{cardsText}</span>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          aria-label={`Delete ${label.name}`}
          onClick={remove}
        >
          Delete
        </button>
      </div>
      {isPicking && (
        <ColorPicker
          value={label.color}
          subject={label.name}
          onChange={async (color) => {
            if (await actions.saveLabel(label.id, label.name, color)) setIsPicking(false)
          }}
        />
      )}
      {isConfirming && (
        <div className="label-row__confirm" role="alert">
          <span>
            Delete "{label.name}"? It comes off {cardsText}.
          </span>
          <button type="button" className="btn btn--danger btn--small" onClick={() => actions.deleteLabel(label.id)}>
            Delete label
          </button>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setIsConfirming(false)}>
            Keep
          </button>
        </div>
      )}
    </li>
  )
}

interface LabelManagerProps {
  board: Board
  actions: BoardActions
  onClose: () => void
}

/** The board's labels in one place: add, rename (click a name), recolour (click its swatch),
 * delete. */
export default function LabelManager({ board, actions, onClose }: LabelManagerProps) {
  const [name, setName] = useState('')
  const [clash, setClash] = useState<string | null>(null)

  async function add(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    const existing = findLabelByName(board.labels, trimmed)
    if (existing) {
      setClash(`There's already a label called "${existing.name}".`)
      return
    }
    setClash(null)
    if (await actions.addLabel(trimmed)) setName('')
  }

  return (
    <Dialog title="Labels" onClose={onClose}>
      {board.labels.length === 0 ? (
        <p className="dialog__text">No labels on this board yet. Add one below, or from any card.</p>
      ) : (
        <ul className="label-list">
          {board.labels.map((label) => (
            <LabelRow key={label.id} label={label} uses={usage(board, label.id)} actions={actions} />
          ))}
        </ul>
      )}
      <form className="label-list__new" onSubmit={add}>
        <input
          className="input"
          aria-label="New label name"
          placeholder="New label"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setClash(null)
          }}
        />
        <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
          Add label
        </button>
      </form>
      {clash ? (
        <p className="field__hint field__hint--error" role="alert">
          {clash}
        </p>
      ) : (
        <p className="field__hint">A new label gets a colour of its own - click its swatch to pick another.</p>
      )}
      <div className="dialog__actions">
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Dialog>
  )
}
