import type { Label } from '../api/types'
import type { CardFilter, FilterMatch } from '../lib/labels'

interface LabelFilterProps {
  labels: Label[]
  filter: CardFilter
  onChange: (filter: CardFilter) => void
}

const MATCHES: { value: FilterMatch; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'all', label: 'All' },
]

/** One toggle per label above the lanes; a card shows when it has any of the ones switched on, or
 * all of them. */
export default function LabelFilter({ labels, filter, onChange }: LabelFilterProps) {
  const selected = filter.labels
  return (
    <div className="label-filter" role="group" aria-label="Filter by label">
      <span className="label-filter__title">Filter</span>
      {labels.map((label) => {
        const isOn = selected.includes(label.id)
        return (
          <button
            key={label.id}
            type="button"
            className={`label-toggle label-color--${label.color}`}
            aria-pressed={isOn}
            onClick={() =>
              onChange({
                ...filter,
                labels: isOn ? selected.filter((each) => each !== label.id) : [...selected, label.id],
              })
            }
          >
            <span className="label-toggle__mark" aria-hidden="true">
              {isOn ? '✓' : ''}
            </span>
            {label.name}
          </button>
        )
      })}
      {/* With one label or none, any and all pick the same cards - so the choice only shows once it matters. */}
      {selected.length > 1 && (
        <div className="segmented segmented--small" role="group" aria-label="Cards need">
          {MATCHES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={filter.match === option.value ? 'is-active' : ''}
              aria-pressed={filter.match === option.value}
              onClick={() => onChange({ ...filter, match: option.value })}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {selected.length > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => onChange({ labels: [], match: 'any' })}
        >
          Clear filter
        </button>
      )}
    </div>
  )
}
