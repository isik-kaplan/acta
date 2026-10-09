import { useState } from 'react'

import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type { Column, Label } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { cardTarget, laneTarget } from '../lib/board'
import { matchesFilter } from '../lib/labels'
import type { CardFilter } from '../lib/labels'
import CardTile from './CardTile'
import ConfirmDialog from './ConfirmDialog'
import InlineEdit from './InlineEdit'
import LaneMenu from './LaneMenu'

function GripIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="8" y="5" width="3" height="3" />
      <rect x="13" y="5" width="3" height="3" />
      <rect x="8" y="10.5" width="3" height="3" />
      <rect x="13" y="10.5" width="3" height="3" />
      <rect x="8" y="16" width="3" height="3" />
      <rect x="13" y="16" width="3" height="3" />
    </svg>
  )
}

interface LaneProps {
  column: Column
  labels: Label[]
  // The labels a card needs any (or all) of to be shown; none shows every card.
  filter: CardFilter
  isEditing: boolean
  isFirst: boolean
  isLast: boolean
  now: Date
  actions: BoardActions
  onOpenCard: (cardId: string) => void
  onAddCard: (columnId: string) => void
}

export default function Lane({
  column,
  labels,
  filter,
  isEditing,
  isFirst,
  isLast,
  now,
  actions,
  onOpenCard,
  onAddCard,
}: LaneProps) {
  // A drop target for cards, and - by its grip, in edit mode - a column to drag among the others.
  const sortable = useSortable({ id: laneTarget(column.id) })
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const count = column.cards.length
  const shown = column.cards.filter((card) => matchesFilter(card, filter))

  function deleteColumn() {
    // Nothing to lose in an empty column, so nothing to confirm.
    if (count === 0) actions.deleteColumn(column.id)
    else setIsConfirmingDelete(true)
  }

  return (
    <section
      ref={sortable.setNodeRef}
      className={sortable.isDragging ? 'lane is-dragging' : 'lane'}
      style={{ transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }}
      aria-label={column.name}
      data-column-id={column.id}
    >
      <header className="lane__header">
        {/* Only the grip starts a column drag, so the name stays a click to rename. Pointer only - the
            options menu's Move left / Move right is the keyboard and screen reader way. */}
        {isEditing && (
          <span
            ref={sortable.setActivatorNodeRef}
            className="lane__grip"
            title="Drag to move"
            aria-hidden="true"
            {...sortable.listeners}
          >
            <GripIcon />
          </span>
        )}
        {isEditing ? (
          <InlineEdit
            value={column.name}
            label="column"
            className="lane__name"
            onSave={(name) => actions.renameColumn(column.id, name)}
          />
        ) : (
          <h2 className="lane__name">{column.name}</h2>
        )}
        {shown.length === count ? (
          <span className="lane__count numeral" aria-label={`${count} ${count === 1 ? 'card' : 'cards'}`}>
            {count}
          </span>
        ) : (
          <span className="lane__count numeral" aria-label={`${shown.length} of ${count} cards shown`}>
            {shown.length}/{count}
          </span>
        )}
        {isEditing && (
          <LaneMenu
            name={column.name}
            canMoveLeft={!isFirst}
            canMoveRight={!isLast}
            onMoveLeft={() => actions.moveColumn(column.id, column.position - 1)}
            onMoveRight={() => actions.moveColumn(column.id, column.position + 1)}
            onDelete={deleteColumn}
          />
        )}
      </header>

      {/* Only the shown cards sort - a hidden one has no tile to shift. Where a drop lands among all
          of them, hidden ones included, is worked out from the full list (lib/board). */}
      <SortableContext
        id={laneTarget(column.id)}
        items={shown.map((card) => cardTarget(card.id))}
        strategy={verticalListSortingStrategy}
      >
        <ol className="lane__cards">
          {shown.map((card) => (
            <CardTile key={card.id} card={card} labels={labels} now={now} onOpen={onOpenCard} />
          ))}
        </ol>
      </SortableContext>

      <button type="button" className="composer__open" onClick={() => onAddCard(column.id)}>
        <span aria-hidden="true">+</span> Add a card
      </button>

      {isConfirmingDelete && (
        <ConfirmDialog
          title={`Delete "${column.name}"?`}
          message={`Its ${count} ${count === 1 ? 'card goes' : 'cards go'} with it. This can't be undone.`}
          confirmLabel="Delete column"
          onConfirm={() => {
            setIsConfirmingDelete(false)
            actions.deleteColumn(column.id)
          }}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </section>
  )
}
