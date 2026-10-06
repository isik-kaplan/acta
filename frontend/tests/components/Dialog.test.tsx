import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ConfirmDialog from '../../src/components/ConfirmDialog'
import Dialog from '../../src/components/Dialog'

describe('Dialog', () => {
  it('is a labelled modal dialog with a heading and its content', () => {
    render(
      <Dialog title="Edit card" onClose={vi.fn()}>
        <p>body</p>
      </Dialog>
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit card' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('heading', { name: 'Edit card' })).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('closes on Escape, but not on other keys', async () => {
    const onClose = vi.fn()
    render(
      <Dialog title="x" onClose={onClose}>
        body
      </Dialog>
    )
    await userEvent.keyboard('a')
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a press on the backdrop, not inside the dialog', () => {
    const onClose = vi.fn()
    render(
      <Dialog title="x" onClose={onClose}>
        body
      </Dialog>
    )
    fireEvent.mouseDown(screen.getByText('body'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape calls the latest onClose it was given', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(
      <Dialog title="x" onClose={first}>
        body
      </Dialog>
    )
    rerender(
      <Dialog title="x" onClose={second}>
        body
      </Dialog>
    )
    await userEvent.keyboard('{Escape}')
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
  })

  it('stops listening for Escape once gone', async () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <Dialog title="x" onClose={onClose}>
        body
      </Dialog>
    )
    unmount()
    await userEvent.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('ConfirmDialog', () => {
  function renderConfirm() {
    const handlers = { onConfirm: vi.fn(), onCancel: vi.fn() }
    render(<ConfirmDialog title="Delete it?" message="Gone for good." confirmLabel="Delete board" {...handlers} />)
    return handlers
  }

  it('asks, with Cancel focused so Enter is the safe choice', () => {
    renderConfirm()
    expect(screen.getByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument()
    expect(screen.getByText('Gone for good.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it('confirms or cancels', async () => {
    const { onConfirm, onCancel } = renderConfirm()
    await userEvent.click(screen.getByRole('button', { name: 'Delete board' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })
})
