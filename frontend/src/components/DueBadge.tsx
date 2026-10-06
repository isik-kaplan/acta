import { dueStatus, formatDue } from '../lib/due'

const LABELS = { overdue: 'Overdue', today: 'Due today', later: 'Due' }

export default function DueBadge({ dueAt, now }: { dueAt: string; now: Date }) {
  const status = dueStatus(dueAt, now)
  return (
    <span className={`due due--${status}`}>
      <span className="visually-hidden">{LABELS[status]}: </span>
      <time className="numeral" dateTime={dueAt}>
        {formatDue(dueAt, now)}
      </time>
    </span>
  )
}
