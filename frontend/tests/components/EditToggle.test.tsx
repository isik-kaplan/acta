import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import EditToggle from '../../src/components/EditToggle'

describe('EditToggle', () => {
  it('reads Edit, unpressed, outside edit mode', async () => {
    const onToggle = vi.fn()
    render(<EditToggle isEditing={false} onToggle={onToggle} />)
    const button = screen.getByRole('button', { name: 'Edit' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('class', 'btn btn--small edit-toggle')
    await userEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('reads Done editing, pressed and primary, in edit mode', () => {
    render(<EditToggle isEditing onToggle={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Done editing' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('class', 'btn btn--small btn--primary edit-toggle')
  })
})
