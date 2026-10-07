import type { ReminderDraft, ReminderUnit } from '../lib/reminders'

const UNITS: ReminderUnit[] = ['minutes', 'hours', 'days', 'weeks']

interface ReminderListProps {
  drafts: ReminderDraft[]
  onChange: (drafts: ReminderDraft[]) => void
}

/** "10 minutes before", "1 day before"... - any number of them, each removable. */
export default function ReminderList({ drafts, onChange }: ReminderListProps) {
  function update(index: number, change: Partial<ReminderDraft>) {
    onChange(drafts.map((draft, at) => (at === index ? { ...draft, ...change } : draft)))
  }

  return (
    <fieldset className="reminders">
      <legend className="reminders__legend">Reminders</legend>
      {drafts.length === 0 ? (
        <p className="field__hint">No reminders for this card.</p>
      ) : (
        <ul className="reminders__list">
          {drafts.map((draft, index) => {
            const label = `Reminder ${index + 1}`
            return (
              <li key={index} className="reminders__row">
                <input
                  className="input numeral reminders__amount"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  required
                  aria-label={label}
                  value={draft.amount}
                  onChange={(event) => update(index, { amount: event.target.value })}
                />
                <select
                  className="select reminders__unit"
                  aria-label={`${label} unit`}
                  value={draft.unit}
                  onChange={(event) => update(index, { unit: event.target.value as ReminderUnit })}
                >
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {draft.amount.trim() === '1' ? unit.slice(0, -1) : unit}
                    </option>
                  ))}
                </select>
                <span className="reminders__before">before</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--small reminders__remove"
                  aria-label={`Remove ${label.toLowerCase()}`}
                  onClick={() => onChange(drafts.filter((_, at) => at !== index))}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--small reminders__add"
        onClick={() => onChange([...drafts, { amount: '10', unit: 'minutes' }])}
      >
        <span aria-hidden="true">+</span> Add reminder
      </button>
    </fieldset>
  )
}
