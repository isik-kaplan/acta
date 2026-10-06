import { useState } from 'react'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import type { Board } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import { findCard, resolveDrop } from '../lib/board'
import { CardFace } from './CardTile'
import Composer from './Composer'
import Lane from './Lane'

// A pointer over a card is also over the lane that holds it - the card wins, since "drop here"
// means "here, among these cards", and the lane only catches drops on its empty space.
export const preferCards: CollisionDetection = (args) => {
  const within = pointerWithin(args)
  const onCard = within.find((collision) => String(collision.id).startsWith('card:'))
  if (onCard) return [onCard]
  return within.length ? within : rectIntersection(args)
}

interface KanbanBoardProps {
  board: Board
  now: Date
  actions: BoardActions
  onOpenCard: (cardId: string) => void
}

export default function KanbanBoard({ board, now, actions, onOpenCard }: KanbanBoardProps) {
  // Mouse: a few pixels of travel tells a drag from a click. Touch: a short hold, so a swipe still
  // scrolls the lanes sideways instead of grabbing whichever card it started on.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeCard = findCard(board, activeId)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  // activeId is never reset: DragOverlay renders nothing once no drag is active, and the next drag
  // start sets it afresh.
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return
    const placement = resolveDrop(board, String(active.id), String(over.id))
    if (placement) actions.moveCard(String(active.id), placement)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={preferCards}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="lanes">
        {board.columns.map((column, index) => (
          <Lane
            key={column.id}
            column={column}
            isFirst={index === 0}
            isLast={index === board.columns.length - 1}
            now={now}
            actions={actions}
            onOpenCard={onOpenCard}
          />
        ))}
        <div className="lane lane--new">
          <Composer noun="column" placeholder="Column name" maxLength={120} onSubmit={actions.addColumn} />
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className="card-tile card-tile--lifted">
            <div className="card-tile__open">
              <CardFace card={activeCard} now={now} />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
