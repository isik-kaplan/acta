import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Column } from '../../src/api/types'
import Lane from '../../src/components/Lane'
import { makeActions } from '../testUtils/actions'
import { card } from '../testUtils/fixtures'

const NOW = new Date('2026-10-06T12:00:00Z')

function renderLane(column: Column, { isFirst = false, isLast = false } = {}) {
  const actions = makeActions()
  const onOpenCard = vi.fn()
  render(
    // No sensors: these tests are about the tile, not dragging it (KanbanBoard.test covers that).
    <DndContext sensors={[]}>
      <Lane column={column} isFirst={isFirst} isLast={isLast} now={NOW} actions={actions} onOpenCard={onOpenCard} />
    </DndContext>
  )
  return { actions, onOpenCard }
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

  it('adds cards to this column from a multi-line composer', async () => {
    const { actions } = renderLane(doing(0))
    await userEvent.click(screen.getByRole('button', { name: 'Add a card' }))
    const field = screen.getByRole('textbox', { name: 'New card' })
    expect(field.tagName).toBe('TEXTAREA')
    expect(field).toHaveAttribute('maxlength', '200')
    expect(field).toHaveAttribute('placeholder', 'What needs doing?')
    await userEvent.type(field, 'Water plants{Enter}')
    expect(actions.addCard).toHaveBeenCalledWith('doing', 'Water plants')
  })

  it('opens a card', async () => {
    const { onOpenCard } = renderLane(doing(1))
    await userEvent.click(screen.getByRole('button', { name: 'K0' }))
    expect(onOpenCard).toHaveBeenCalledWith('k0')
  })
})
