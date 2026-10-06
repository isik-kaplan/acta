import { useEffect } from 'react'

import { Link, useParams, useSearchParams } from 'react-router'

import CardEditor from '../components/CardEditor'
import InlineEdit from '../components/InlineEdit'
import KanbanBoard from '../components/KanbanBoard'
import { useBoard } from '../hooks/useBoard'
import { useNow } from '../hooks/useNow'
import { findCard } from '../lib/board'
import { rememberLastBoard } from '../lib/lastBoard'

export default function BoardPage() {
  const { boardId } = useParams() as { boardId: string }
  // The open card lives in the URL, so a reminder's notification can link straight to it.
  const [searchParams, setSearchParams] = useSearchParams()
  const { board, loadError, actionError, dismissError, reload, actions } = useBoard(boardId)
  const now = useNow()

  useEffect(() => rememberLastBoard(boardId), [boardId])

  if (loadError) {
    return (
      <div className="page">
        <div className="banner banner--error">{loadError}</div>
        <div className="page__actions">
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
          <Link to="/boards" className="btn btn--ghost">
            All boards
          </Link>
        </div>
      </div>
    )
  }
  if (!board) return <div className="centered-loader">Loading…</div>

  const openCard = findCard(board, searchParams.get('card'))
  const cardCount = board.columns.reduce((total, column) => total + column.cards.length, 0)

  return (
    <div className="board">
      <header className="board__header">
        <InlineEdit value={board.name} label="board" className="board__name" onSave={actions.renameBoard} />
        <span className="board__meta numeral">
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </span>
      </header>

      {actionError && (
        <div className="banner banner--error banner--dismissable" role="alert">
          <span>{actionError}</span>
          <button type="button" className="btn btn--ghost btn--small" onClick={dismissError}>
            Dismiss
          </button>
        </div>
      )}

      <KanbanBoard
        board={board}
        now={now}
        actions={actions}
        onOpenCard={(cardId) => setSearchParams({ card: cardId })}
      />

      {openCard && (
        <CardEditor
          key={openCard.id}
          card={openCard}
          columns={board.columns}
          actions={actions}
          onClose={() => setSearchParams({})}
        />
      )}
    </div>
  )
}
