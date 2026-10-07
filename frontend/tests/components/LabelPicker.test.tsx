import { useState } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Label } from '../../src/api/types'
import LabelPicker from '../../src/components/LabelPicker'
import { LABELS } from '../testUtils/fixtures'

function Harness({
  initial,
  onCreate,
  onSubmit,
}: {
  initial: string[]
  onCreate: (name: string) => Promise<Label | null>
  onSubmit: () => void
}) {
  const [selected, setSelected] = useState(initial)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <LabelPicker labels={LABELS} selected={selected} onSelect={setSelected} onCreate={onCreate} />
      <output>{selected.join(',')}</output>
    </form>
  )
}

function renderPicker(
  initial: string[] = [],
  onCreate = vi.fn(async (name: string): Promise<Label | null> => ({ id: `new-${name}`, name, color: 'sky' }))
) {
  const onSubmit = vi.fn()
  render(<Harness initial={initial} onCreate={onCreate} onSubmit={onSubmit} />)
  return { onCreate, onSubmit }
}

const selected = () => screen.getByRole('status').textContent
const toggle = (name: string) => screen.getByRole('button', { name: new RegExp(`${name}$`) })
const newField = () => screen.getByRole('textbox', { name: 'New label' })
const addButton = () => screen.getByRole('button', { name: 'Add label' })

describe('LabelPicker', () => {
  it('shows every board label as a toggle, on for the ones the card has', () => {
    renderPicker(['l-home'])
    expect(screen.getByRole('group', { name: 'Labels' })).toBeInTheDocument()
    expect(toggle('Urgent')).toHaveAttribute('aria-pressed', 'false')
    expect(toggle('Home')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle('Home')).toHaveTextContent(/^✓Home$/)
    expect(toggle('Urgent')).toHaveTextContent(/^Urgent$/)
    expect(toggle('Errand')).toHaveClass('label-toggle', 'label-color--teal')
  })

  it('toggles labels on and off', async () => {
    renderPicker(['l-home'])
    await userEvent.click(toggle('Urgent'))
    expect(selected()).toBe('l-home,l-urgent')
    await userEvent.click(toggle('Home'))
    expect(selected()).toBe('l-urgent')
  })

  it('makes a new label from its name and puts it on the card', async () => {
    const { onCreate } = renderPicker()
    expect(addButton()).toBeDisabled()
    await userEvent.type(newField(), '   ')
    expect(addButton()).toBeDisabled()
    await userEvent.clear(newField())
    await userEvent.type(newField(), '  Garden  ')
    await userEvent.click(addButton())
    expect(onCreate).toHaveBeenCalledWith('Garden')
    expect(selected()).toBe('new-Garden')
    expect(newField()).toHaveValue('')
  })

  it('adds on Enter without submitting the form around it', async () => {
    const { onCreate, onSubmit } = renderPicker()
    await userEvent.type(newField(), 'Garden{Enter}')
    expect(onCreate).toHaveBeenCalledWith('Garden')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does nothing on Enter with a blank name, and lets other keys type', async () => {
    const { onCreate, onSubmit } = renderPicker()
    await userEvent.type(newField(), '   {Enter}')
    expect(onCreate).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(newField()).toHaveValue('   ')
  })

  it('picks the existing label for a name the board already has, without making another', async () => {
    const { onCreate } = renderPicker(['l-home'])
    await userEvent.type(newField(), 'home{Enter}')
    await userEvent.type(newField(), ' URGENT {Enter}')
    expect(onCreate).not.toHaveBeenCalled()
    expect(selected()).toBe('l-home,l-urgent')
    expect(newField()).toHaveValue('')
  })

  it('keeps the name, picks nothing, when making the label failed', async () => {
    renderPicker([], vi.fn().mockResolvedValue(null))
    await userEvent.type(newField(), 'Garden{Enter}')
    expect(selected()).toBe('')
    expect(newField()).toHaveValue('Garden')
    expect(addButton()).toBeEnabled()
  })

  it('waits for one new label before taking another', async () => {
    let finish: (label: Label) => void = () => {}
    const onCreate = vi.fn(() => new Promise<Label | null>((resolve) => (finish = resolve)))
    renderPicker([], onCreate)
    await userEvent.type(newField(), 'Garden{Enter}')
    expect(addButton()).toBeDisabled()
    await userEvent.type(newField(), '{Enter}')
    expect(onCreate).toHaveBeenCalledTimes(1)
    finish({ id: 'l-garden', name: 'Garden', color: 'lime' })
    await vi.waitFor(() => expect(selected()).toBe('l-garden'))
  })

  it('keeps a label picked while a new one was being made', async () => {
    let finish: (label: Label) => void = () => {}
    renderPicker(
      [],
      vi.fn(() => new Promise<Label | null>((resolve) => (finish = resolve)))
    )
    await userEvent.type(newField(), 'Garden{Enter}')
    await userEvent.click(toggle('Urgent'))
    finish({ id: 'l-garden', name: 'Garden', color: 'lime' })
    await vi.waitFor(() => expect(selected()).toBe('l-urgent,l-garden'))
  })
})

describe('LabelPicker on a board without labels', () => {
  it('offers only the field for a first one', () => {
    render(<LabelPicker labels={[]} selected={[]} onSelect={vi.fn()} onCreate={vi.fn()} />)
    expect(screen.queryAllByRole('button', { pressed: false })).toEqual([])
    expect(document.querySelector('.label-picker__options')).toBeNull()
    expect(newField()).toHaveAttribute('placeholder', 'New label')
  })
})
