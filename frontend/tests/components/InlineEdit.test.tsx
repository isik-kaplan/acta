import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import InlineEdit from '../../src/components/InlineEdit'

function renderEdit(onSave = vi.fn().mockResolvedValue(true)) {
  render(<InlineEdit value="To do" label="column" className="lane__name" onSave={onSave} />)
  return onSave
}

const startEditing = () => userEvent.click(screen.getByRole('button', { name: 'To do' }))
const input = () => screen.getByRole('textbox', { name: 'column name' })

describe('InlineEdit', () => {
  it('shows the value as a button with the given class', () => {
    renderEdit()
    const button = screen.getByRole('button', { name: 'To do' })
    expect(button).toHaveAttribute('class', 'inline-edit lane__name')
    expect(button).toHaveAttribute('title', 'Rename column')
  })

  it('turns into a focused input holding the value', async () => {
    renderEdit()
    await startEditing()
    expect(input()).toHaveFocus()
    expect(input()).toHaveValue('To do')
    expect(input()).toHaveAttribute('class', 'inline-edit__input lane__name')
    expect(input()).toHaveAttribute('maxlength', '120')
  })

  it('saves the trimmed value on Enter', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.clear(input())
    await userEvent.type(input(), '  Inbox {Enter}')
    expect(onSave).toHaveBeenCalledWith('Inbox')
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('saves on blur too', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.type(input(), '!')
    await userEvent.tab()
    expect(onSave).toHaveBeenCalledWith('To do!')
  })

  it('saves once, not again on the blur that follows Enter', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.type(input(), '!{Enter}')
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('does not save an unchanged or blank value', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.type(input(), '{Enter}')
    await startEditing()
    await userEvent.clear(input())
    await userEvent.type(input(), '   {Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('Escape puts the old value back without saving', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.type(input(), 'xyz{Escape}')
    expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('a fresh edit after an Escape saves normally', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.type(input(), 'xyz{Escape}')
    await startEditing()
    await userEvent.type(input(), '!{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('To do!')
  })

  it('other keys just type', async () => {
    const onSave = renderEdit()
    await startEditing()
    await userEvent.type(input(), '{ArrowLeft}x')
    expect(input()).toHaveValue('To dxo')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('takes a custom maximum length', async () => {
    render(<InlineEdit value="x" label="board" className="c" onSave={vi.fn()} maxLength={10} />)
    await userEvent.click(screen.getByRole('button', { name: 'x' }))
    expect(screen.getByRole('textbox', { name: 'board name' })).toHaveAttribute('maxlength', '10')
  })
})
