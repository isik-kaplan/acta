import { useEffect, useState } from 'react'

import { Navigate } from 'react-router'

import * as endpoints from '../api/endpoints'
import { errorMessage } from '../lib/errors'
import { readLastBoard } from '../lib/lastBoard'

/** "/" is a redirect: to the board you were last on if it still exists, else your first board,
 * else the board list (where an account with none can make one). */
export default function Home() {
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    endpoints
      .fetchBoards()
      .then((boards) => {
        const last = readLastBoard()
        const board = boards.find((each) => each.id === last) ?? boards[0]
        setTarget(board ? `/boards/${board.id}` : '/boards')
      })
      .catch((caught) => setError(errorMessage(caught)))
  }, [attempt])

  if (target) return <Navigate to={target} replace />
  if (error) {
    return (
      <div className="page">
        <div className="banner banner--error">{error}</div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null)
            // Stryker disable next-line ArithmeticOperator: any change to the counter re-runs the effect; the direction is irrelevant
            setAttempt(attempt + 1)
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  return <div className="centered-loader">Loading…</div>
}
