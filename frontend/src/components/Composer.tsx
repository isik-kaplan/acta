import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'

interface ComposerProps {
  noun: string
  placeholder: string
  maxLength: number
  onSubmit: (value: string) => Promise<boolean>
  multiline?: boolean
}

/** A collapsed "Add a …" button that opens into a field. It stays open and empties after each add,
 * so a run of cards can be typed one Enter after another. */
export default function Composer({ noun, placeholder, maxLength, onSubmit, multiline = false }: ComposerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  // Adds run one after another, in the order they were typed: the field clears the moment Enter is
  // pressed so the next card can be typed straight away, and a fast typist's second Enter must
  // neither be dropped nor race the first one to the server.
  const queue = useRef(Promise.resolve())

  function close() {
    setIsOpen(false)
    setValue('')
  }

  function submit(event?: FormEvent) {
    event?.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setValue('')
    queue.current = queue.current.then(async () => {
      // A failed add gives its text back - unless something new was typed in the meantime.
      if (!(await onSubmit(trimmed))) setValue((current) => current || trimmed)
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === 'Escape') close()
    // Shift+Enter still breaks the line in a card title; plain Enter adds.
    if (multiline && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  if (!isOpen) {
    return (
      <button type="button" className="composer__open" onClick={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> Add a {noun}
      </button>
    )
  }

  const fieldProps = {
    'aria-label': `New ${noun}`,
    placeholder,
    value,
    maxLength,
    autoFocus: true,
    onKeyDown: handleKeyDown,
  }

  return (
    <form className="composer" onSubmit={submit}>
      {multiline ? (
        <textarea
          className="input composer__field"
          {...fieldProps}
          rows={2}
          onChange={(event) => setValue(event.target.value)}
        />
      ) : (
        <input className="input composer__field" {...fieldProps} onChange={(event) => setValue(event.target.value)} />
      )}
      <div className="composer__actions">
        <button type="submit" className="btn btn--primary btn--small" disabled={!value.trim()}>
          Add {noun}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={close}>
          Cancel
        </button>
      </div>
    </form>
  )
}
