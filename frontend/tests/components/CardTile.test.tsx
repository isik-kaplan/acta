import { DndContext } from '@dnd-kit/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import CardTile from '../../src/components/CardTile'
import DueBadge from '../../src/components/DueBadge'
import { card } from '../testUtils/fixtures'

const NOW = new Date('2026-10-06T12:00:00Z')

function renderTile(overrides = {}) {
  const onOpen = vi.fn()
  render(
    // No sensors: these tests are about the tile, not dragging it (KanbanBoard.test covers that).
    <DndContext sensors={[]}>
      <ol>
        <CardTile card={card('k1', 'todo', 0, { title: 'Water plants', ...overrides })} now={NOW} onOpen={onOpen} />
      </ol>
    </DndContext>
  )
  return onOpen
}

describe('CardTile', () => {
  it('shows just the title for a plain card', () => {
    renderTile()
    const tile = screen.getByRole('listitem')
    expect(tile).toHaveAttribute('class', 'card-tile')
    expect(tile).toHaveAttribute('data-card-id', 'k1')
    expect(screen.getByRole('button')).toHaveTextContent(/^Water plants$/)
    expect(document.querySelector('.card-tile__meta')).toBeNull()
  })

  it('shows the due date and a notes mark when the card has them', () => {
    renderTile({ due_at: '2026-10-06T15:00:00Z', notes: 'some notes' })
    expect(screen.getByText('Today 15:00')).toBeInTheDocument()
    expect(screen.getByText('Has notes')).toBeInTheDocument()
    expect(document.querySelector('.card-tile__notes svg')).not.toBeNull()
  })

  it('shows only what the card has', () => {
    renderTile({ notes: 'some notes' })
    expect(screen.getByText('Has notes')).toBeInTheDocument()
    expect(document.querySelector('time')).toBeNull()
  })

  it('opens on click', async () => {
    const onOpen = renderTile()
    await userEvent.click(screen.getByRole('button', { name: 'Water plants' }))
    expect(onOpen).toHaveBeenCalledWith('k1')
  })
})

describe('DueBadge', () => {
  it.each([
    ['2026-10-05T09:00:00Z', 'due due--overdue', 'Overdue:'],
    ['2026-10-06T18:00:00Z', 'due due--today', 'Due today:'],
    ['2026-10-09T09:00:00Z', 'due due--later', 'Due:'],
  ])('%s is styled and announced by its status', (dueAt, className, label) => {
    const { container } = render(<DueBadge dueAt={dueAt} now={NOW} />)
    expect(container.firstChild).toHaveAttribute('class', className)
    expect(screen.getByText(label)).toHaveClass('visually-hidden')
    expect(container.firstChild).toHaveTextContent(`${label} `)
    expect(container.querySelector('time')).toHaveAttribute('datetime', dueAt)
  })
})
