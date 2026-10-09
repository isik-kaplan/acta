import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Column, Label } from '../../src/api/types'
import Lane from '../../src/components/Lane'
import type { FilterMatch } from '../../src/lib/labels'
import { makeActions } from '../testUtils/actions'
import { LABELS, card } from '../testUtils/fixtures'

const NOW = new Date('2026-10-06T12:00:00Z')

function renderLane(
  column: Column,
  {
    isFirst = false,
    isLast = false,
    isEditing = true,
    labels = [] as Label[],
    filter = [] as string[],
    match = 'any' as FilterMatch,
  } = {}
) {
  const actions = makeActions()
  const onOpenCard = vi.fn()
  const onAddCard = vi.fn()
  render(
    // No sensors: these tests are about the tile, not dragging it (KanbanBoard.test covers that).
    <DndContext sensors={[]}>
      <Lane
        column={column}
        labels={labels}
        filter={{ labels: filter, match }}
        isEditing={isEditing}
        isFirst={isFirst}
        isLast={isLast}
        now={NOW}
        actions={actions}
        onAddCard={onAddCard}
        onOpenCard={onOpenCard}
      />
    </DndContext>
  )
  return { actions, onOpenCard, onAddCard }
}

const doing = (count: number): Column => ({
  id: 'doing',
  name: 'Doing',
  position: 1,
  cards: Array.from({ length: count }, (_, index) => card(`k${index}`, 'doing', index)),
})

async function deleteFromMenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Doing options' }))
  await userEvent.click(screen.getByRole('button', { name: 'Delete column' }))
}

describe('Lane', () => {
  it('is a region named after the column, with its card count', () => {
    renderLane(doing(2))
    const lane = screen.getByRole('region', { name: 'Doing' })
    expect(lane).toHaveAttribute('class', 'lane')
    expect(lane).toHaveAttribute('data-column-id', 'doing')
    expect(screen.getByLabelText('2 cards')).toHaveTextContent('2')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('out of edit mode, shows the name as a heading with no rename or menu', () => {
    renderLane(doing(2), { isEditing: false })
    expect(screen.getByRole('heading', { level: 2, name: 'Doing' })).toHaveClass('lane__name')
    expect(screen.queryByRole('button', { name: 'Doing' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Doing options' })).toBeNull()
    expect(screen.getByLabelText('2 cards')).toBeInTheDocument()
  })

  it('has a grip to drag it by in edit mode only', () => {
    renderLane(doing(1))
    const grip = document.querySelector('.lane__grip')!
    expect(grip).toHaveAttribute('aria-hidden', 'true')
    expect(grip).toHaveAttribute('title', 'Drag to move')
    expect(grip.parentElement).toHaveClass('lane__header')
    expect(grip.parentElement!.firstElementChild).toBe(grip)
    expect(grip.querySelectorAll('svg > rect')).toHaveLength(6)
  })

  it('has no grip out of edit mode', () => {
    renderLane(doing(1), { isEditing: false })
    expect(document.querySelector('.lane__grip')).toBeNull()
  })

  it('counts a single card in the singular', () => {
    renderLane(doing(1))
    expect(screen.getByLabelText('1 card')).toBeInTheDocument()
  })

  it('renames the column', async () => {
    const { actions } = renderLane(doing(0))
    await userEvent.click(screen.getByRole('button', { name: 'Doing' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'column name' }), ' now{Enter}')
    expect(actions.renameColumn).toHaveBeenCalledWith('doing', 'Doing now')
  })

  it('moves the column one place either way', async () => {
    const { actions } = renderLane(doing(0))
    await userEvent.click(screen.getByRole('button', { name: 'Doing options' }))
    await userEvent.click(screen.getByRole('button', { name: 'Move left' }))
    expect(actions.moveColumn).toHaveBeenLastCalledWith('doing', 0)
    await userEvent.click(screen.getByRole('button', { name: 'Doing options' }))
    await userEvent.click(screen.getByRole('button', { name: 'Move right' }))
    expect(actions.moveColumn).toHaveBeenLastCalledWith('doing', 2)
  })

  it('passes its place on the board through to the menu', async () => {
    renderLane(doing(0), { isFirst: true, isLast: true })
    await userEvent.click(screen.getByRole('button', { name: 'Doing options' }))
    expect(screen.getByRole('button', { name: 'Move left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled()
  })

  it('deletes an empty column without asking', async () => {
    const { actions } = renderLane(doing(0))
    await deleteFromMenu()
    expect(actions.deleteColumn).toHaveBeenCalledWith('doing')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('asks before deleting a column with cards in it', async () => {
    const { actions } = renderLane(doing(2))
    await deleteFromMenu()
    expect(screen.getByRole('dialog', { name: 'Delete "Doing"?' })).toBeInTheDocument()
    expect(screen.getByText("Its 2 cards go with it. This can't be undone.")).toBeInTheDocument()
    expect(actions.deleteColumn).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Delete column' }))
    expect(actions.deleteColumn).toHaveBeenCalledWith('doing')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('says "card goes" for one card, and can be cancelled', async () => {
    const { actions } = renderLane(doing(1))
    await deleteFromMenu()
    expect(screen.getByText("Its 1 card goes with it. This can't be undone.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(actions.deleteColumn).not.toHaveBeenCalled()
  })

  it('asks to add a card to this column', async () => {
    const { onAddCard, actions } = renderLane(doing(0), { isEditing: false })
    await userEvent.click(screen.getByRole('button', { name: 'Add a card' }))
    expect(onAddCard).toHaveBeenCalledWith('doing')
    expect(actions.addCard).not.toHaveBeenCalled()
  })

  it('opens a card', async () => {
    const { onOpenCard } = renderLane(doing(1))
    await userEvent.click(screen.getByRole('button', { name: 'K0' }))
    expect(onOpenCard).toHaveBeenCalledWith('k0')
  })
})

describe('Lane with a label filter', () => {
  const mixed: Column = {
    id: 'todo',
    name: 'To do',
    position: 0,
    cards: [
      card('k0', 'todo', 0, { labels: ['l-home'] }),
      card('k1', 'todo', 1, { labels: ['l-urgent'] }),
      card('k2', 'todo', 2),
    ],
  }

  it('shows only the cards with a filtered label, and how many of all', () => {
    renderLane(mixed, { labels: LABELS, filter: ['l-home'] })
    expect(screen.getAllByRole('listitem').map((item) => item.getAttribute('data-card-id'))).toEqual(['k0'])
    expect(screen.getByLabelText('1 of 3 cards shown')).toHaveTextContent(/^1\/3$/)
    expect(screen.getByText('Home')).toHaveClass('label-color--green')
  })

  it('shows the plain count when the filter hides nothing', () => {
    renderLane({ ...mixed, cards: mixed.cards.slice(0, 2) }, { labels: LABELS, filter: ['l-home', 'l-urgent'] })
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByLabelText('2 cards')).toHaveTextContent(/^2$/)
  })
})
