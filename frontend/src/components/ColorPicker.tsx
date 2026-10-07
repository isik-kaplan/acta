import { useId } from 'react'

import type { LabelColor } from '../api/types'
import { LABEL_COLORS } from '../lib/labels'

interface ColorPickerProps {
  value: LabelColor
  // What the colours are for, for the group's name: "Colour for Urgent".
  subject: string
  onChange: (color: LabelColor) => void
}

/** Every label colour as a swatch - a radio group underneath, so arrow keys move between them. */
export default function ColorPicker({ value, subject, onChange }: ColorPickerProps) {
  const group = useId()
  return (
    <div className="color-picker" role="radiogroup" aria-label={`Colour for ${subject}`}>
      {LABEL_COLORS.map((color) => (
        <label key={color} className={`color-swatch label-color--${color}`} title={color}>
          <input
            type="radio"
            className="color-swatch__input"
            name={group}
            value={color}
            checked={color === value}
            aria-label={color}
            onChange={() => onChange(color)}
          />
        </label>
      ))}
    </div>
  )
}
