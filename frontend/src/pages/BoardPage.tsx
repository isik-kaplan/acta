import { useEffect, useState } from 'react'

import { Link, useParams, useSearchParams } from 'react-router'

import CardEditor from '../components/CardEditor'
import EditToggle from '../components/EditToggle'
import InlineEdit from '../components/InlineEdit'
import KanbanBoard from '../components/KanbanBoard'
import LabelFilter from '../components/LabelFilter'
import LabelManager from '../components/LabelManager'
import { useBoard } from '../hooks/useBoard'
import { useNow } from '../hooks/useNow'
import { findCard } from '../lib/board'
import type { CardFilter } from '../lib/labels'
import { rememberLastBoard } from '../lib/lastBoard'

export default function BoardPage() {
  const { boardId } = useParams() as { boardId: string }
  // The open card lives in the URL, so a reminder's notification can link straight to it - and so
  // does the label filter, so a filtered board can be bookmarked or reloaded as it was.
  const [searchParams, setSearchParams] = useSearchParams()
  const { board, loadError, actionError, dismissError, reload, actions } = useBoard(boardId)
  const now = useNow()
  const [isEditing, setIsEditing] = useState(false)
  // The column a new card is being written for, while its form is open.
  const [newCardColumn, setNewCardColumn] = useState<string | null>(null)
  const [isManagingLabels, setIsManagingLabels] = useState(false)

  // An empty value takes the param out of the url.
  function setParams(values: Record<string, string>) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const [name, value] of Object.entries(values)) {
        if (value) next.set(name, value)
        else next.delete(name)
      }
      return next
    })
  }

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
  const filter: CardFilter = {
    // Ids of labels since deleted are dropped rather than filtering every card out.
    // Stryker disable next-line StringLiteral: whatever stands in for a missing param is kept only if it is a label id, which no default is
    labels: (searchParams.get('labels') ?? '').split(',').filter((id) => board.labels.some((label) => label.id === id)),
    // Any is the default and stays out of the url; only all is written there.
    match: searchParams.get('match') === 'all' ? 'all' : 'any',
  }

  return (
    <div className="board">
      <header className="board__header">
        {isEditing ? (
          <InlineEdit value={board.name} label="board" className="board__name" onSave={actions.renameBoard} />
        ) : (
          <h1 className="board__name">{board.name}</h1>
        )}
        <span className="board__meta numeral">
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </span>
        <div className="board__tools">
          <button type="button" className="btn btn--small" onClick={() => setIsManagingLabels(true)}>
            Labels
          </button>
          <EditToggle isEditing={isEditing} onToggle={() => setIsEditing(!isEditing)} />
        </div>
      </header>

      {board.labels.length > 0 && (
        <LabelFilter
          labels={board.labels}
          filter={filter}
          onChange={(next) => setParams({ labels: next.labels.join(','), match: next.match === 'all' ? 'all' : '' })}
        />
      )}

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
        isEditing={isEditing}
        filter={filter}
        now={now}
        actions={actions}
        onOpenCard={(cardId) => setParams({ card: cardId })}
        onAddCard={setNewCardColumn}
      />

      {openCard && (
        <CardEditor
          key={openCard.id}
          card={openCard}
          columnId={openCard.column_id}
          columns={board.columns}
          labels={board.labels}
          actions={actions}
          onClose={() => setParams({ card: '' })}
        />
      )}
      {newCardColumn && (
        <CardEditor
          card={null}
          columnId={newCardColumn}
          columns={board.columns}
          labels={board.labels}
          actions={actions}
          onClose={() => setNewCardColumn(null)}
        />
      )}
      {isManagingLabels && <LabelManager board={board} actions={actions} onClose={() => setIsManagingLabels(false)} />}
    </div>
  )
}
