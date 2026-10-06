import { useEffect, useRef, useState } from 'react'

interface LaneMenuProps {
  name: string
  canMoveLeft: boolean
  canMoveRight: boolean
  onMoveLeft: () => void
  onMoveRight: () => void
  onDelete: () => void
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="10.5" width="3" height="3" />
      <rect x="10.5" y="10.5" width="3" height="3" />
      <rect x="17" y="10.5" width="3" height="3" />
    </svg>
  )
}

export default function LaneMenu({
  name,
  canMoveLeft,
  canMoveRight,
  onMoveLeft,
  onMoveRight,
  onDelete,
}: LaneMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handlePointer(event: MouseEvent) {
      if (!root.current!.contains(event.target as Node)) setIsOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isOpen])

  function choose(action: () => void) {
    setIsOpen(false)
    action()
  }

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="btn btn--ghost btn--icon btn--small"
        aria-label={`${name} options`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        <DotsIcon />
      </button>
      {isOpen && (
        <div className="menu__panel">
          <button type="button" className="menu__item" disabled={!canMoveLeft} onClick={() => choose(onMoveLeft)}>
            Move left
          </button>
          <button type="button" className="menu__item" disabled={!canMoveRight} onClick={() => choose(onMoveRight)}>
            Move right
          </button>
          <button type="button" className="menu__item menu__item--danger" onClick={() => choose(onDelete)}>
            Delete column
          </button>
        </div>
      )}
    </div>
  )
}
