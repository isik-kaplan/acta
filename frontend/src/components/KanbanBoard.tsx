import { useState } from 'react'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'

import type { Board } from '../api/types'
import type { BoardActions } from '../hooks/useBoard'
import {
  findCard,
  isPastMiddle,
  laneTarget,
  previewCardOver,
  resolveCardDrop,
  resolveColumnDrop,
  targetCard,
  targetColumn,
} from '../lib/board'
import { matchesFilter } from '../lib/labels'
import type { CardFilter } from '../lib/labels'
import { CardFace } from './CardTile'
import Composer from './Composer'
import Lane from './Lane'

const isLane = (id: unknown) => targetColumn(String(id)) !== null

/** The lane above or below the pointer, if it's in line with one. */
function laneInLine({ droppableContainers, droppableRects, pointerCoordinates }: Parameters<CollisionDetection>[0]) {
  if (!pointerCoordinates) return undefined
  const { x } = pointerCoordinates
  return droppableContainers.find((each) => {
    const rect = droppableRects.get(each.id)
    return isLane(each.id) && rect !== undefined && rect.left <= x && x <= rect.right
  })
}

// A dragged column only lands among the columns, at the nearest one. A dragged card lands on the
// card under the pointer - also over the lane holding it, and the card wins. Over a lane's empty
// space, it's the nearest of that lane's cards, so the gap opens beside them rather than jumping to
// the bottom; only a lane with no cards shown is a target itself.
//
// Only where the pointer is counts for a card, never what the dragged copy merely overlaps: a card
// moving into another lane reshapes both, and an overlap-based guess can then flip it back and forth
// between them forever. A lane is only as tall as its cards, so below one the pointer is still in
// it - a lane's sides don't move as cards come and go, so that's as steady. Between lanes the card
// stays put.
export const pickTarget: CollisionDetection = (args) => {
  if (isLane(args.active.id)) {
    return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((each) => isLane(each.id)) })
  }
  const hits = pointerWithin(args)
  const onCard = hits.find((hit) => !isLane(hit.id))
  if (onCard) return [onCard]
  const lane = hits[0] ?? laneInLine(args)
  if (!lane) return []
  const cards = args.droppableContainers.filter((each) => each.data.current?.sortable.containerId === lane.id)
  return cards.length ? closestCenter({ ...args, droppableContainers: cards }) : [lane]
}

interface KanbanBoardProps {
  board: Board
  // Edit mode brings out the column controls - renaming, dragging, the per-column menu, adding a
  // column. Out of it the board is just columns and cards, which is what it's looked at for nearly
  // all the time.
  isEditing: boolean
  // The labels to filter the cards by - only cards with any (or all) of them show. Dragging still places
  // cards among all of a column's cards, hidden ones included, so the order the server keeps is
  // the order seen once the filter is cleared.
  filter: CardFilter
  now: Date
  actions: BoardActions
  onOpenCard: (cardId: string) => void
  onAddCard: (columnId: string) => void
}

export default function KanbanBoard({
  board,
  isEditing,
  filter,
  now,
  actions,
  onOpenCard,
  onAddCard,
}: KanbanBoardProps) {
  // Mouse: a few pixels of travel tells a drag from a click. Touch: a short hold, so a swipe still
  // scrolls the lanes sideways instead of grabbing whichever card it started on.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )
  // Empty until the first drag starts - no card or column has that id.
  // Stryker disable next-line StringLiteral: only the overlay uses it, which shows nothing until a drag start replaces it
  const [activeId, setActiveId] = useState('')
  // The board as it stands mid-drag - the dragged card moved into whichever column it's over, so
  // that column opens a gap for it - or null between drags.
  const [preview, setPreview] = useState<Board | null>(null)
  const shown = preview ?? board
  const activeCard = findCard(shown, targetCard(activeId))
  const activeColumn = shown.columns.find((column) => column.id === targetColumn(activeId))

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
    setPreview(board)
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const cardId = targetCard(String(active.id))
    const pastMiddle = isPastMiddle(active.rect.current.translated, over.rect)
    setPreview((current) => previewCardOver(current!, cardId, String(over.id), pastMiddle))
  }

  // activeId is never reset: DragOverlay renders nothing once no drag is active, and the next drag
  // start sets it afresh.
  // Let go over nothing - between lanes, say - a card still lands where its faded stand-in is.
  function handleDragEnd({ active, over }: DragEndEvent) {
    const dragged = preview!
    setPreview(null)
    const overId = over && String(over.id)
    const columnId = targetColumn(String(active.id))
    if (columnId !== null) {
      const index = resolveColumnDrop(board, columnId, overId)
      if (index !== null) actions.moveColumn(columnId, index)
      return
    }
    const cardId = targetCard(String(active.id))!
    const placement = resolveCardDrop(board, dragged, cardId, overId)
    if (placement) actions.moveCard(cardId, placement)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pickTarget}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setPreview(null)}
    >
      <SortableContext
        id="lanes"
        items={shown.columns.map((column) => laneTarget(column.id))}
        strategy={horizontalListSortingStrategy}
      >
        <div className="lanes">
          {shown.columns.map((column, index) => (
            <Lane
              key={column.id}
              column={column}
              labels={shown.labels}
              filter={filter}
              isEditing={isEditing}
              isFirst={index === 0}
              isLast={index === shown.columns.length - 1}
              now={now}
              actions={actions}
              onOpenCard={onOpenCard}
              onAddCard={onAddCard}
            />
          ))}
          {/* A board with no columns offers the add slot anyway - there'd be nothing else to do on it. */}
          {(isEditing || shown.columns.length === 0) && (
            <div className="lane lane--new">
              <Composer noun="column" placeholder="Column name" onSubmit={actions.addColumn} />
            </div>
          )}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeCard && (
          <div className="card-tile card-tile--lifted">
            <div className="card-tile__open">
              <CardFace card={activeCard} labels={board.labels} now={now} />
            </div>
          </div>
        )}
        {activeColumn && (
          <div className="lane lane--lifted">
            <div className="lane__header">
              <span className="lane__name">{activeColumn.name}</span>
            </div>
            <ol className="lane__cards">
              {activeColumn.cards
                .filter((card) => matchesFilter(card, filter))
                .map((card) => (
                  <li key={card.id} className="card-tile">
                    <div className="card-tile__open">
                      <CardFace card={card} labels={board.labels} now={now} />
                    </div>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
