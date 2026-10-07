import type { Label } from '../api/types'

/** A label as it shows on a card: its name on its colour. */
export default function LabelChip({ label }: { label: Label }) {
  return <span className={`label-chip label-color--${label.color}`}>{label.name}</span>
}

/** The card's labels, in the board's order. Ids the board doesn't know (a label deleted a moment
 * ago, before the card caught up) are skipped. */
export function CardLabels({ ids, labels }: { ids: string[]; labels: Label[] }) {
  const shown = labels.filter((label) => ids.includes(label.id))
  if (shown.length === 0) return null
  return (
    <span className="card-tile__labels">
      {shown.map((label) => (
        <LabelChip key={label.id} label={label} />
      ))}
    </span>
  )
}
