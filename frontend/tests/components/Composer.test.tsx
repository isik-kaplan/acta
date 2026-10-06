import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Composer from '../../src/components/Composer'

function renderComposer(onSubmit = vi.fn().mockResolvedValue(true), multiline = false) {
  render(
    <Composer noun="card" placeholder="What needs doing?" maxLength={200} onSubmit={onSubmit} multiline={multiline} />
  )
  return onSubmit
}

const open = () => userEvent.click(screen.getByRole('button', { name: 'Add a card' }))
const field = () => screen.getByRole('textbox', { name: 'New card' })

describe('Composer', () => {
  it('starts collapsed and opens into a focused, empty field', async () => {
    renderComposer()
    expect(screen.queryByRole('textbox')).toBeNull()
    await open()
    expect(field()).toHaveFocus()
    expect(field()).toHaveValue('')
    expect(field()).toHaveAttribute('placeholder', 'What needs doing?')
    expect(field()).toHaveAttribute('maxlength', '200')
    expect(field().tagName).toBe('INPUT')
  })

  it('submits the trimmed value, then stays open and empty for the next one', async () => {
    const onSubmit = renderComposer()
    await open()
    await userEvent.type(field(), '  Water plants  ')
    expect(screen.getByRole('button', { name: 'Add card' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Add card' }))
    expect(onSubmit).toHaveBeenCalledWith('Water plants')
    expect(field()).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled()
  })

  it('gives the text back when the add fails', async () => {
    const onSubmit = renderComposer(vi.fn().mockResolvedValue(false))
    await open()
    await userEvent.type(field(), 'Water plants{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(field()).toHaveValue('Water plants'))
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

  it('a multi-line field ignores Enter on blank text', async () => {
    const onSubmit = renderComposer(vi.fn().mockResolvedValue(true), true)
    await open()
    await userEvent.type(field(), '   {Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(field()).toHaveValue('   ')
  })

  it('will not submit blank text', async () => {
    const onSubmit = renderComposer()
    await open()
    expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled()
    await userEvent.type(field(), '   {Enter}')
    expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('clears at once and queues adds typed while one is still saving, in order', async () => {
    const finishers: Array<(value: boolean) => void> = []
    const onSubmit = renderComposer(
      vi.fn(() => new Promise<boolean>((resolve) => finishers.push(resolve))),
      true
    )
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

  it('is a textarea when multiline: Enter adds, Shift+Enter breaks the line', async () => {
    const onSubmit = renderComposer(vi.fn().mockResolvedValue(true), true)
    await open()
    expect(field().tagName).toBe('TEXTAREA')
    expect(field()).toHaveAttribute('rows', '2')
    await userEvent.type(field(), 'line one{Shift>}{Enter}{/Shift}line two')
    expect(field()).toHaveValue('line one\nline two')
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.type(field(), '{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('line one\nline two')
    expect(field()).toHaveValue('')
  })

  it('a single-line field submits on Enter through the form, and ignores other keys', async () => {
    const onSubmit = renderComposer()
    await open()
    await userEvent.type(field(), 'a{ArrowLeft}b{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('ba')
  })
})
