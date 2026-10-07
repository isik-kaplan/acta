interface EditToggleProps {
  isEditing: boolean
  onToggle: () => void
}

/** The one switch into edit mode, the same on every page. Outside it nothing renames, moves or
 * deletes on a click - only the add buttons stay live - so a stray tap can't change a name. */
export default function EditToggle({ isEditing, onToggle }: EditToggleProps) {
  return (
    <button
      type="button"
      className={isEditing ? 'btn btn--small btn--primary edit-toggle' : 'btn btn--small edit-toggle'}
      aria-pressed={isEditing}
      onClick={onToggle}
    >
      {isEditing ? 'Done editing' : 'Edit'}
    </button>
  )
}
