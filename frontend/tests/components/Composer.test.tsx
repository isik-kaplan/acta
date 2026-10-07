import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Composer from '../../src/components/Composer'

function renderComposer(onSubmit = vi.fn().mockResolvedValue(true)) {
  render(<Composer noun="column" placeholder="Column name" onSubmit={onSubmit} />)
  return onSubmit
}

const open = () => userEvent.click(screen.getByRole('button', { name: 'Add a column' }))
const field = () => screen.getByRole('textbox', { name: 'New column' })
const addButton = () => screen.getByRole('button', { name: 'Add column' })

describe('Composer', () => {
  it('starts collapsed and opens into a focused, empty one-line field', async () => {
    renderComposer()
    expect(screen.queryByRole('textbox')).toBeNull()
    await open()
    expect(field()).toHaveFocus()
    expect(field()).toHaveValue('')
    expect(field()).toHaveAttribute('placeholder', 'Column name')
    expect(field()).not.toHaveAttribute('maxlength')
    expect(field().tagName).toBe('INPUT')
  })

  it('submits the trimmed value, then stays open and empty for the next one', async () => {
    const onSubmit = renderComposer()
    await open()
    await userEvent.type(field(), '  Later  ')
    expect(addButton()).toBeEnabled()
    await userEvent.click(addButton())
    expect(onSubmit).toHaveBeenCalledWith('Later')
    expect(field()).toHaveValue('')
    expect(addButton()).toBeDisabled()
  })

  it('submits on Enter', async () => {
    const onSubmit = renderComposer()
    await open()
    await userEvent.type(field(), 'a{ArrowLeft}b{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('ba')
  })

  it('gives the text back when the add fails', async () => {
    const onSubmit = renderComposer(vi.fn().mockResolvedValue(false))
    await open()
    await userEvent.type(field(), 'Later{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(field()).toHaveValue('Later'))
  })

  it("does not overwrite something new with a failed add's text", async () => {
    let fail: (value: boolean) => void = () => {}
    renderComposer(vi.fn(() => new Promise<boolean>((resolve) => (fail = resolve))))
    await open()
    await userEvent.type(field(), 'first{Enter}')
    await userEvent.type(field(), 'second')
    fail(false)
    await vi.waitFor(() => expect(field()).toHaveValue('second'))
  })

  it('will not submit blank text', async () => {
    const onSubmit = renderComposer()
    await open()
    expect(addButton()).toBeDisabled()
    await userEvent.type(field(), '   {Enter}')
    expect(addButton()).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears at once and queues adds typed while one is still saving, in order', async () => {
    const finishers: Array<(value: boolean) => void> = []
    const onSubmit = renderComposer(vi.fn(() => new Promise<boolean>((resolve) => finishers.push(resolve))))
    await open()
    await userEvent.type(field(), 'one{Enter}')
    expect(field()).toHaveValue('')
    await userEvent.type(field(), 'two{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenLastCalledWith('one')
    finishers[0](true)
    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
    expect(onSubmit).toHaveBeenLastCalledWith('two')
    finishers[1](true)
    expect(field()).toHaveValue('')
  })

  it('Escape and Cancel both close and forget the draft', async () => {
    renderComposer()
    await open()
    await userEvent.type(field(), 'draft{Escape}')
    expect(screen.queryByRole('textbox')).toBeNull()
    await open()
    expect(field()).toHaveValue('')
    await userEvent.type(field(), 'again')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('textbox')).toBeNull()
    await open()
    expect(field()).toHaveValue('')
  })
})
