import { useState } from 'react'

import { useDroppable } from '@dnd-kit/core'

import type { Column, Label } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { columnTarget } from '../lib/board'
import { matchesFilter } from '../lib/labels'
import type { CardFilter } from '../lib/labels'
import CardTile from './CardTile'
import ConfirmDialog from './ConfirmDialog'
import InlineEdit from './InlineEdit'
import LaneMenu from './LaneMenu'

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
  const droppable = useDroppable({ id: columnTarget(column.id) })
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
      ref={droppable.setNodeRef}
      className={droppable.isOver ? 'lane is-over' : 'lane'}
      aria-label={column.name}
      data-column-id={column.id}
    >
      <header className="lane__header">
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

      <ol className="lane__cards">
        {shown.map((card) => (
          <CardTile key={card.id} card={card} labels={labels} now={now} onOpen={onOpenCard} />
        ))}
      </ol>

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
