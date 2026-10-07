import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface ComposerProps {
  noun: string
  placeholder: string
  onSubmit: (value: string) => Promise<boolean>
}

/** A collapsed "Add a …" button that opens into a one-line field - for columns and boards, which
 * are just a name. It stays open and empties after each add, so several can be typed in a row. */
export default function Composer({ noun, placeholder, onSubmit }: ComposerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  // Adds run one after another, in the order they were typed: the field clears the moment Enter is
  // pressed so the next name can be typed straight away, and a fast second Enter must neither be
  // dropped nor race the first one to the server.
  const queue = useRef(Promise.resolve())

  function close() {
    setIsOpen(false)
    setValue('')
  }

  // Never called with blank text: the submit button is disabled then, and a browser won't submit a
  // form on Enter while its only submit button is disabled.
  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = value.trim()
    setValue('')
    queue.current = queue.current.then(async () => {
      // A failed add gives its text back - unless something new was typed in the meantime.
      if (!(await onSubmit(trimmed))) setValue((current) => current || trimmed)
    })
  }

  if (!isOpen) {
    return (
      <button type="button" className="composer__open" onClick={() => setIsOpen(true)}>
        <span aria-hidden="true">+</span> Add a {noun}
      </button>
    )
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        className="input composer__field"
        aria-label={`New ${noun}`}
        placeholder={placeholder}
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      />
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
