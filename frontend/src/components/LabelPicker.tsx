import { useState } from 'react'

import type { Label } from '../api/types'
import { findLabelByName } from '../lib/labels'

interface LabelPickerProps {
  labels: Label[]
  selected: string[]
  // Takes an updater, not a list: a new label is picked once it comes back from the server, by
  // which time the list may have changed under a closure taken before the request.
  onSelect: (update: (current: string[]) => string[]) => void
  onCreate: (name: string) => Promise<Label | null>
}

/** The board's labels as toggles, and a field to make a new one - which joins the board's list and
 * goes straight on the card. */
export default function LabelPicker({ labels, selected, onSelect, onCreate }: LabelPickerProps) {
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  function pick(labelId: string) {
    onSelect((current) => (current.includes(labelId) ? current : [...current, labelId]))
  }

  function toggle(labelId: string) {
    onSelect((current) =>
      current.includes(labelId) ? current.filter((each) => each !== labelId) : [...current, labelId]
    )
  }

  async function add() {
    const trimmed = name.trim()
    // Typing a name the board already has picks that label rather than asking for a second one.
    const existing = findLabelByName(labels, trimmed)
    if (existing) {
      pick(existing.id)
      setName('')
      return
    }
    setIsCreating(true)
    const created = await onCreate(trimmed)
    setIsCreating(false)
    if (!created) return
    pick(created.id)
    setName('')
  }

  return (
    <fieldset className="label-picker">
      <legend className="reminders__legend">Labels</legend>
      {labels.length > 0 && (
        <div className="label-picker__options">
          {labels.map((label) => {
            const isOn = selected.includes(label.id)
            return (
              <button
                key={label.id}
                type="button"
                className={`label-toggle label-color--${label.color}`}
                aria-pressed={isOn}
                onClick={() => toggle(label.id)}
              >
                <span className="label-toggle__mark" aria-hidden="true">
                  {isOn ? '✓' : ''}
                </span>
                {label.name}
              </button>
            )
          })}
        </div>
      )}
      <div className="label-picker__new">
        <input
          className="input"
          aria-label="New label"
          placeholder="New label"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            // Enter here adds the label; it must not submit the whole card form.
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (name.trim() && !isCreating) add()
          }}
        />
        <button type="button" className="btn btn--small" disabled={!name.trim() || isCreating} onClick={add}>
          Add label
        </button>
      </div>
    </fieldset>
  )
}
