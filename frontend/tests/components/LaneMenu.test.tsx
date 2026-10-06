import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import LaneMenu from '../../src/components/LaneMenu'

function renderMenu(props: Partial<Parameters<typeof LaneMenu>[0]> = {}) {
  const handlers = { onMoveLeft: vi.fn(), onMoveRight: vi.fn(), onDelete: vi.fn() }
  render(
    <div>
      <p>outside</p>
      <LaneMenu name="Doing" canMoveLeft canMoveRight {...handlers} {...props} />
    </div>
  )
  return handlers
}

const toggle = () => screen.getByRole('button', { name: 'Doing options' })

describe('LaneMenu', () => {
  it('opens and closes from its button', async () => {
    renderMenu()
    expect(toggle()).toHaveAttribute('aria-expanded', 'false')
    expect(toggle().querySelectorAll('svg rect')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Move left' })).toBeNull()
    await userEvent.click(toggle())
    expect(toggle()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle())
    expect(screen.queryByRole('button', { name: 'Move left' })).toBeNull()
  })

  it.each([
    ['Move left', 'onMoveLeft'],
    ['Move right', 'onMoveRight'],
    ['Delete column', 'onDelete'],
  ] as const)('%s runs its action and closes the menu', async (label, handler) => {
    const handlers = renderMenu()
    await userEvent.click(toggle())
    await userEvent.click(screen.getByRole('button', { name: label }))
    expect(handlers[handler]).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  })

  it('disables the moves it cannot make', async () => {
    renderMenu({ canMoveLeft: false, canMoveRight: false })
    await userEvent.click(toggle())
    expect(screen.getByRole('button', { name: 'Move left' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Move right' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete column' })).toBeEnabled()
  })

  it('closes on a press outside it, but not inside it', async () => {
    renderMenu()
    await userEvent.click(toggle())
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Move left' }))
    expect(screen.getByRole('button', { name: 'Move left' })).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByRole('button', { name: 'Move left' })).toBeNull()
  })

  it('closes on Escape only', async () => {
    renderMenu()
    await userEvent.click(toggle())
    await userEvent.keyboard('a')
    expect(screen.getByRole('button', { name: 'Move left' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: 'Move left' })).toBeNull()
  })

  it('stops listening once closed', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    renderMenu()
    expect(add).not.toHaveBeenCalledWith('mousedown', expect.any(Function))
    await userEvent.click(toggle())
    expect(add).toHaveBeenCalledWith('mousedown', expect.any(Function))
    await userEvent.click(toggle())
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})
