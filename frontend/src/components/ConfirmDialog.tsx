import Dialog from './Dialog'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Only for what can't be undone and takes more than itself with it - a board, a column full of
// cards. Deleting a single card asks nothing; it's one tap to make again.
export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className="dialog__text">{message}</p>
      <div className="dialog__actions">
        <button type="button" className="btn btn--danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} autoFocus>
          Cancel
        </button>
      </div>
    </Dialog>
  )
}
