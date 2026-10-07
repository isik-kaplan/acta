import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Board } from '../../src/api/types'
import LabelManager from '../../src/components/LabelManager'
import type { BoardActions } from '../../src/hooks/useBoard'
import { makeActions } from '../testUtils/actions'
import { makeBoard, makeLabelledBoard } from '../testUtils/fixtures'

function renderManager(board: Board = makeLabelledBoard(), actions: BoardActions = makeActions()) {
  const onClose = vi.fn()
  render(<LabelManager board={board} actions={actions} onClose={onClose} />)
  return { actions, onClose }
}

const row = (name: string) => screen.getByRole('button', { name }).closest('li')!
const nameField = () => screen.getByRole('textbox', { name: 'New label name' })
const addButton = () => screen.getByRole('button', { name: 'Add label' })

describe('LabelManager', () => {
  it('lists the board labels with their colour and how many cards use each', () => {
    renderManager()
    expect(screen.getByRole('dialog', { name: 'Labels' })).toBeInTheDocument()
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((each) => each.textContent)).toEqual([
      'Urgent1 cardDelete',
      'Home1 cardDelete',
      'Errand2 cardsDelete',
    ])
    expect(screen.getByRole('button', { name: 'Colour of Urgent: red' })).toHaveClass(
      'color-swatch',
      'label-color--red'
    )
    expect(screen.getByRole('button', { name: 'Colour of Urgent: red' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('label-chip', 'label-color--green')
  })

  it('says so when the board has no labels yet', () => {
    renderManager(makeBoard())
    expect(screen.getByText('No labels on this board yet. Add one below, or from any card.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('adds a label by name, with the colour left to the server, and clears the field', async () => {
    const { actions } = renderManager()
    expect(addButton()).toBeDisabled()
    await userEvent.type(nameField(), '   ')
    expect(addButton()).toBeDisabled()
    await userEvent.type(nameField(), '  Garden ')
    await userEvent.click(addButton())
    expect(actions.addLabel).toHaveBeenCalledWith('Garden')
    expect(nameField()).toHaveValue('')
  })

  it('keeps the name when adding failed', async () => {
    const { actions } = renderManager(makeLabelledBoard(), makeActions({ addLabel: vi.fn().mockResolvedValue(null) }))
    await userEvent.type(nameField(), 'Garden{Enter}')
    expect(actions.addLabel).toHaveBeenCalledWith('Garden')
    expect(nameField()).toHaveValue('Garden')
  })

  it('refuses a name the board already has, until the name changes', async () => {
    const { actions } = renderManager()
    expect(screen.getByText(/A new label gets a colour of its own/)).toBeInTheDocument()
    await userEvent.type(nameField(), ' home {Enter}')
    expect(actions.addLabel).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(`There's already a label called "Home".`)
    expect(screen.queryByText(/A new label gets a colour of its own/)).toBeNull()
    await userEvent.type(nameField(), 's')
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.type(nameField(), '{Enter}')
    expect(actions.addLabel).toHaveBeenCalledWith('home s')
  })

  it('renames a label by clicking its name, keeping its colour', async () => {
    const { actions } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: 'Home' }))
    const field = screen.getByRole('textbox', { name: 'label name' })
    await userEvent.clear(field)
    await userEvent.type(field, 'House{Enter}')
    expect(actions.saveLabel).toHaveBeenCalledWith('l-home', 'House', 'green')
  })

  it('recolours a label from its swatch, and folds the picker away once saved', async () => {
    const { actions } = renderManager()
    const swatch = screen.getByRole('button', { name: 'Colour of Home: green' })
    await userEvent.click(swatch)
    expect(swatch).toHaveAttribute('aria-expanded', 'true')
    expect(within(row('Home')).getByRole('radio', { name: 'green' })).toBeChecked()
    await userEvent.click(within(row('Home')).getByRole('radio', { name: 'brown' }))
    expect(actions.saveLabel).toHaveBeenCalledWith('l-home', 'Home', 'brown')
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('keeps the picker open when recolouring failed, and folds it away on a second click', async () => {
    renderManager(makeLabelledBoard(), makeActions({ saveLabel: vi.fn().mockResolvedValue(false) }))
    const swatch = screen.getByRole('button', { name: 'Colour of Home: green' })
    await userEvent.click(swatch)
    await userEvent.click(screen.getByRole('radio', { name: 'brown' }))
    expect(screen.getByRole('radiogroup', { name: 'Colour for Home' })).toBeInTheDocument()
    await userEvent.click(swatch)
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('deletes a label no card uses straight away', async () => {
    const board = makeLabelledBoard()
    board.labels = [...board.labels, { id: 'l-spare', name: 'Spare', color: 'slate' }]
    const { actions } = renderManager(board)
    expect(row('Spare')).toHaveTextContent('0 cards')
    await userEvent.click(screen.getByRole('button', { name: 'Delete Spare' }))
    expect(actions.deleteLabel).toHaveBeenCalledWith('l-spare')
  })

  it('asks first, in its row, before deleting a label cards use', async () => {
    const { actions } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Errand' }))
    expect(actions.deleteLabel).not.toHaveBeenCalled()
    expect(within(row('Errand')).getByRole('alert')).toHaveTextContent('Delete "Errand"? It comes off 2 cards.')
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.queryByRole('alert')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Delete Urgent' }))
    expect(within(row('Urgent')).getByRole('alert')).toHaveTextContent('It comes off 1 card.')
    await userEvent.click(screen.getByRole('button', { name: 'Delete label' }))
    expect(actions.deleteLabel).toHaveBeenCalledWith('l-urgent')
  })

  it('closes with Done', async () => {
    const { onClose } = renderManager()
    await userEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })
})
