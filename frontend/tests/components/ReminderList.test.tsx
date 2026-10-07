import { useState } from 'react'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ReminderList from '../../src/components/ReminderList'
import type { ReminderDraft } from '../../src/lib/reminders'

function Harness({ initial, onChange }: { initial: ReminderDraft[]; onChange: (drafts: ReminderDraft[]) => void }) {
  const [drafts, setDrafts] = useState(initial)
  return (
    <ReminderList
      drafts={drafts}
      onChange={(next) => {
        onChange(next)
        setDrafts(next)
      }}
    />
  )
}

function renderList(initial: ReminderDraft[]) {
  const onChange = vi.fn()
  render(<Harness initial={initial} onChange={onChange} />)
  return onChange
}

const rows = () => screen.queryAllByRole('listitem')
const lastChange = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.lastCall![0]

describe('ReminderList', () => {
  it('says so when there are none', () => {
    renderList([])
    expect(screen.getByRole('group', { name: 'Reminders' })).toBeInTheDocument()
    expect(screen.getByText('No reminders for this card.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('shows each reminder as an amount, a unit and "before"', () => {
    renderList([
      { amount: '10', unit: 'minutes' },
      { amount: '2', unit: 'days' },
    ])
    expect(rows()).toHaveLength(2)
    expect(screen.getByLabelText('Reminder 1')).toHaveValue(10)
    expect(screen.getByLabelText('Reminder 2 unit')).toHaveValue('days')
    expect(rows()[0]).toHaveTextContent('before')
    expect(screen.queryByText('No reminders for this card.')).toBeNull()
    expect(
      within(rows()[0])
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['minutes', 'hours', 'days', 'weeks'])
  })

  it('names the units in the singular for an amount of one', () => {
    renderList([{ amount: ' 1 ', unit: 'days' }])
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['minute', 'hour', 'day', 'week'])
    expect(screen.getByLabelText('Reminder 1 unit')).toHaveValue('days')
  })

  it('takes whole amounts with no upper bound', () => {
    renderList([{ amount: '1', unit: 'weeks' }])
    const amount = screen.getByLabelText('Reminder 1')
    expect(amount).toHaveAttribute('type', 'number')
    expect(amount).toHaveAttribute('min', '0')
    expect(amount).not.toHaveAttribute('max')
    expect(amount).toHaveAttribute('step', '1')
    expect(amount).toHaveAttribute('inputmode', 'numeric')
    expect(amount).toBeRequired()
  })

  it('adds a 10-minute reminder at the end', async () => {
    const onChange = renderList([{ amount: '0', unit: 'minutes' }])
    await userEvent.click(screen.getByRole('button', { name: 'Add reminder' }))
    expect(lastChange(onChange)).toEqual([
      { amount: '0', unit: 'minutes' },
      { amount: '10', unit: 'minutes' },
    ])
  })

  it('changes only the reminder edited', async () => {
    const onChange = renderList([
      { amount: '1', unit: 'hours' },
      { amount: '5', unit: 'minutes' },
    ])
    await userEvent.type(screen.getByLabelText('Reminder 2'), '0')
    expect(lastChange(onChange)).toEqual([
      { amount: '1', unit: 'hours' },
      { amount: '50', unit: 'minutes' },
    ])
    await userEvent.selectOptions(screen.getByLabelText('Reminder 1 unit'), 'days')
    expect(lastChange(onChange)).toEqual([
      { amount: '1', unit: 'days' },
      { amount: '50', unit: 'minutes' },
    ])
  })

  it('removes just the one asked for', async () => {
    const onChange = renderList([
      { amount: '1', unit: 'hours' },
      { amount: '2', unit: 'hours' },
      { amount: '3', unit: 'hours' },
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Remove reminder 2' }))
    expect(lastChange(onChange)).toEqual([
      { amount: '1', unit: 'hours' },
      { amount: '3', unit: 'hours' },
    ])
    expect(rows()).toHaveLength(2)
  })

  it('keeps offering more however many there are', async () => {
    const many = Array.from({ length: 50 }, (_, index) => ({ amount: String(index), unit: 'minutes' as const }))
    renderList(many)
    await userEvent.click(screen.getByRole('button', { name: 'Add reminder' }))
    expect(rows()).toHaveLength(51)
    expect(screen.getByRole('button', { name: 'Add reminder' })).toBeInTheDocument()
  })
})
