import { useState } from 'react'

import { useDroppable } from '@dnd-kit/core'

import type { Column } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { columnTarget } from '../lib/board'
import CardTile from './CardTile'
import Composer from './Composer'
import ConfirmDialog from './ConfirmDialog'
import InlineEdit from './InlineEdit'
import LaneMenu from './LaneMenu'

interface LaneProps {
  column: Column
  isFirst: boolean
  isLast: boolean
  now: Date
  actions: BoardActions
  onOpenCard: (cardId: string) => void
}

export default function Lane({ column, isFirst, isLast, now, actions, onOpenCard }: LaneProps) {
  const droppable = useDroppable({ id: columnTarget(column.id) })
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const count = column.cards.length

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
        <InlineEdit
          value={column.name}
          label="column"
          className="lane__name"
          onSave={(name) => actions.renameColumn(column.id, name)}
        />
        <span className="lane__count numeral" aria-label={`${count} ${count === 1 ? 'card' : 'cards'}`}>
          {count}
        </span>
        <LaneMenu
          name={column.name}
          canMoveLeft={!isFirst}
          canMoveRight={!isLast}
          onMoveLeft={() => actions.moveColumn(column.id, column.position - 1)}
          onMoveRight={() => actions.moveColumn(column.id, column.position + 1)}
          onDelete={deleteColumn}
        />
      </header>

      <ol className="lane__cards">
        {column.cards.map((card) => (
          <CardTile key={card.id} card={card} now={now} onOpen={onOpenCard} />
        ))}
      </ol>

      <Composer
        noun="card"
        placeholder="What needs doing?"
        maxLength={200}
        multiline
        onSubmit={(title) => actions.addCard(column.id, title)}
      />

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
