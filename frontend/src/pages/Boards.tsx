import { useEffect, useState } from 'react'

import { Link, useNavigate } from 'react-router'

import * as endpoints from '../api/endpoints'
import type { BoardSummary } from '../api/types'
import Composer from '../components/Composer'
import ConfirmDialog from '../components/ConfirmDialog'
import InlineEdit from '../components/InlineEdit'
import { errorMessage } from '../lib/errors'

export default function Boards() {
  const navigate = useNavigate()
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BoardSummary | null>(null)

  useEffect(() => {
    endpoints
      .fetchBoards()
      .then(setBoards)
      .catch((caught) => setError(errorMessage(caught)))
  }, [])

  async function attempt(action: () => Promise<void>): Promise<boolean> {
    setError(null)
    try {
      await action()
      // Stryker disable next-line BooleanLiteral: only a Composer reads this, and the one success that reaches it - creating a board - navigates away, unmounting it
      return true
    } catch (caught) {
      setError(errorMessage(caught))
      return false
    }
  }

  const create = (name: string) =>
    attempt(async () => {
      const board = await endpoints.createBoard(name)
      navigate(`/boards/${board.id}`)
    })

  const rename = (boardId: string, name: string) =>
    attempt(async () => {
      const renamed = await endpoints.renameBoard(boardId, name)
      setBoards((current) => current!.map((each) => (each.id === boardId ? renamed : each)))
    })

  async function confirmDelete(board: BoardSummary) {
    setDeleting(null)
    await attempt(async () => {
      await endpoints.deleteBoard(board.id)
      setBoards((current) => current!.filter((each) => each.id !== board.id))
    })
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Boards</h1>
      </header>

      {error && <div className="banner banner--error">{error}</div>}

      {boards === null ? (
        !error && <div className="centered-loader">Loading…</div>
      ) : (
        <>
          {boards.length === 0 && <p className="page__empty">No boards yet. Make one below.</p>}
          <ul className="board-list">
            {boards.map((board) => (
              <li key={board.id} className="board-list__item">
                <InlineEdit
                  value={board.name}
                  label="board"
                  className="board-list__name"
                  onSave={(name) => rename(board.id, name)}
                />
                <Link to={`/boards/${board.id}`} className="btn btn--small">
                  Open
                </Link>
                <button type="button" className="btn btn--ghost btn--small" onClick={() => setDeleting(board)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <div className="board-list__new">
            <Composer noun="board" placeholder="Board name" maxLength={120} onSubmit={create} />
          </div>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          message="Every column and card on it goes too. This can't be undone."
          confirmLabel="Delete board"
          onConfirm={() => confirmDelete(deleting)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
