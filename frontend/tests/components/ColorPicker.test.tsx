import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import ColorPicker from '../../src/components/ColorPicker'
import { LABEL_COLORS } from '../../src/lib/labels'

describe('ColorPicker', () => {
  it('offers every colour as a swatch, the current one checked', () => {
    render(<ColorPicker value="teal" subject="Urgent" onChange={vi.fn()} />)
    const group = screen.getByRole('radiogroup', { name: 'Colour for Urgent' })
    const radios = screen.getAllByRole('radio')
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual(LABEL_COLORS)
    expect(screen.getByRole('radio', { name: 'teal' })).toBeChecked()
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(1)
    expect(new Set(radios.map((radio) => radio.getAttribute('name'))).size).toBe(1)
    expect(screen.getByRole('radio', { name: 'red' }).closest('label')).toHaveClass('color-swatch', 'label-color--red')
    expect(screen.getByRole('radio', { name: 'red' }).closest('label')).toHaveAttribute('title', 'red')
    expect(group).toHaveClass('color-picker')
  })

  it('reports the colour picked', async () => {
    const onChange = vi.fn()
    render(<ColorPicker value="teal" subject="Urgent" onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'violet' }))
    expect(onChange).toHaveBeenCalledWith('violet')
  })

  it('keeps two pickers on one page apart', () => {
    render(
      <>
        <ColorPicker value="teal" subject="A" onChange={vi.fn()} />
        <ColorPicker value="red" subject="B" onChange={vi.fn()} />
      </>
    )
    const names = screen.getAllByRole('radio').map((radio) => radio.getAttribute('name'))
    expect(new Set(names).size).toBe(2)
  })
})
