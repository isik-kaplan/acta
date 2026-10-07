import { useDraggable, useDroppable } from '@dnd-kit/core'

import type { Card, Label } from '../api/types'
import { cardTarget } from '../lib/board'
import DueBadge from './DueBadge'
import { CardLabels } from './LabelChip'

function NotesIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 4h10M3 8h10M3 12h6" strokeLinecap="square" />
    </svg>
  )
}

/** What a card looks like - shared by the tile on the board and the copy that follows the pointer
 * while it's dragged. */
export function CardFace({ card, labels, now }: { card: Card; labels: Label[]; now: Date }) {
  return (
    <>
      <span className="card-tile__title">{card.title}</span>
      {card.summary && <span className="card-tile__summary">{card.summary}</span>}
      {/* After the title in the markup, so a screen reader names the card before its labels, but
          shown above it (order: -1). */}
      <CardLabels ids={card.labels} labels={labels} />
      {(card.due_at || card.notes) && (
        <span className="card-tile__meta">
          {card.due_at && <DueBadge dueAt={card.due_at} now={now} />}
          {card.notes && (
            <span className="card-tile__notes" title="Has notes">
              <NotesIcon />
              <span className="visually-hidden">Has notes</span>
            </span>
          )}
        </span>
      )}
    </>
  )
}

interface CardTileProps {
  card: Card
  labels: Label[]
  now: Date
  onOpen: (cardId: string) => void
}

export default function CardTile({ card, labels, now, onOpen }: CardTileProps) {
  const draggable = useDraggable({ id: card.id })
  const droppable = useDroppable({ id: cardTarget(card.id) })

  let className = 'card-tile'
  if (draggable.isDragging) className += ' is-dragging'
  else if (droppable.isOver) className += ' is-over'

  return (
    <li
      ref={(node) => {
        draggable.setNodeRef(node)
        droppable.setNodeRef(node)
      }}
      className={className}
      data-card-id={card.id}
      {...draggable.listeners}
    >
      {/* The tile is the drag source, the button inside it the way in: a press that doesn't move
          past the sensors' thresholds never starts a drag, so it lands here as a plain click. */}
      <button type="button" className="card-tile__open" onClick={() => onOpen(card.id)}>
        <CardFace card={card} labels={labels} now={now} />
      </button>
    </li>
  )
}
