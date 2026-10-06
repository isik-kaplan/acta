import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

interface InlineEditProps {
  value: string
  label: string
  onSave: (value: string) => Promise<boolean>
  className: string
  maxLength?: number
}

/** Text that turns into an input when clicked. Enter or leaving the field saves, Escape puts the
 * old value back; saving an empty or unchanged value is a no-op rather than an error. */
export default function InlineEdit({ value, label, onSave, className, maxLength = 120 }: InlineEditProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const discard = useRef(false)

  // Every way out - Enter, Escape, clicking elsewhere - ends in this one blur, so it runs exactly
  // once. Closing straight from the key handler instead would leave the browser's own blur, fired
  // as the input leaves the page, to save a second time (or save what Escape meant to throw away).
  async function handleBlur() {
    const next = draft!.trim()
    const discarded = discard.current
    discard.current = false
    setDraft(null)
    if (!discarded && next && next !== value) await onSave(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') discard.current = true
    if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
  }

  if (draft === null) {
    return (
      <button
        type="button"
        className={`inline-edit ${className}`}
        onClick={() => setDraft(value)}
        title={`Rename ${label}`}
      >
        {value}
      </button>
    )
  }
  return (
    <input
      className={`inline-edit__input ${className}`}
      aria-label={`${label} name`}
      value={draft}
      maxLength={maxLength}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    />
  )
}
