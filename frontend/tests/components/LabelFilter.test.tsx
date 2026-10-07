import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import LabelFilter from '../../src/components/LabelFilter'
import type { FilterMatch } from '../../src/lib/labels'
import { LABELS } from '../testUtils/fixtures'

function renderFilter(selected: string[], match: FilterMatch = 'any') {
  const onChange = vi.fn()
  render(<LabelFilter labels={LABELS} filter={{ labels: selected, match }} onChange={onChange} />)
  return onChange
}

const toggle = (name: string) => screen.getByRole('button', { name: new RegExp(`${name}$`) })

describe('LabelFilter', () => {
  it('shows a toggle per label, on for the filtered ones', () => {
    renderFilter(['l-home'])
    expect(screen.getByRole('group', { name: 'Filter by label' })).toHaveTextContent(/^Filter/)
    expect(toggle('Home')).toHaveAttribute('aria-pressed', 'true')
    expect(toggle('Home')).toHaveTextContent(/^✓Home$/)
    expect(toggle('Urgent')).toHaveAttribute('aria-pressed', 'false')
    expect(toggle('Urgent')).toHaveTextContent(/^Urgent$/)
    expect(toggle('Urgent')).toHaveClass('label-toggle', 'label-color--red')
  })

  it('adds and removes labels from the filter', async () => {
    const onChange = renderFilter(['l-home'])
    await userEvent.click(toggle('Urgent'))
    expect(onChange).toHaveBeenLastCalledWith({ labels: ['l-home', 'l-urgent'], match: 'any' })
    await userEvent.click(toggle('Home'))
    expect(onChange).toHaveBeenLastCalledWith({ labels: [], match: 'any' })
  })

  it('switching one off leaves the others on', async () => {
    const onChange = renderFilter(['l-urgent', 'l-home', 'l-errand'], 'all')
    await userEvent.click(toggle('Home'))
    expect(onChange).toHaveBeenCalledWith({ labels: ['l-urgent', 'l-errand'], match: 'all' })
  })

  it('offers to clear only while something is filtered, going back to any', async () => {
    const onChange = renderFilter(['l-home', 'l-errand'], 'all')
    await userEvent.click(screen.getByRole('button', { name: 'Clear filter' }))
    expect(onChange).toHaveBeenCalledWith({ labels: [], match: 'any' })
  })

  it('offers any or all once two labels are on', async () => {
    const onChange = renderFilter(['l-home', 'l-errand'])
    const match = screen.getByRole('group', { name: 'Cards need' })
    expect(within(match).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(match).getByRole('button', { name: 'Any' })).toHaveClass('is-active')
    expect(within(match).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(match).getByRole('button', { name: 'All' })).not.toHaveClass('is-active')
    await userEvent.click(within(match).getByRole('button', { name: 'All' }))
    expect(onChange).toHaveBeenCalledWith({ labels: ['l-home', 'l-errand'], match: 'all' })
  })

  it('shows which match is on', async () => {
    const onChange = renderFilter(['l-home', 'l-errand'], 'all')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Any' }))
    expect(onChange).toHaveBeenCalledWith({ labels: ['l-home', 'l-errand'], match: 'any' })
  })

  it('keeps any or all hidden while it would make no difference', () => {
    renderFilter(['l-home'], 'all')
    expect(screen.queryByRole('group', { name: 'Cards need' })).toBeNull()
  })

  it('has nothing to clear with no filter', () => {
    renderFilter([])
    expect(screen.queryByRole('button', { name: 'Clear filter' })).toBeNull()
  })
})
