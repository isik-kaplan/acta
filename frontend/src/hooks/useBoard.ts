import { useCallback, useEffect, useState } from 'react'

import * as endpoints from '../api/endpoints'
import type { Board, CardFields } from '../api/types'
import * as boards from '../lib/board'
import type { Placement } from '../lib/board'
import { errorMessage } from '../lib/errors'

export interface BoardActions {
  addCard: (columnId: string, title: string) => Promise<boolean>
  saveCard: (cardId: string, fields: CardFields) => Promise<boolean>
  deleteCard: (cardId: string) => Promise<boolean>
  moveCard: (cardId: string, placement: Placement) => Promise<boolean>
  addColumn: (name: string) => Promise<boolean>
  renameColumn: (columnId: string, name: string) => Promise<boolean>
  moveColumn: (columnId: string, index: number) => Promise<boolean>
  deleteColumn: (columnId: string) => Promise<boolean>
  renameBoard: (name: string) => Promise<boolean>
}

export interface BoardState {
  board: Board | null
  loadError: string | null
  actionError: string | null
  dismissError: () => void
  reload: () => void
  actions: BoardActions
}

export function useBoard(boardId: string): BoardState {
  const [board, setBoard] = useState<Board | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    // Switching boards quickly can leave an older request still in flight - only the response for
    // the board on screen may land.
    let current = true
    setBoard(null)
    setLoadError(null)
    endpoints
      .fetchBoard(boardId)
      .then((loaded) => current && setBoard(loaded))
      .catch((error) => current && setLoadError(errorMessage(error)))
    return () => {
      current = false
    }
  }, [boardId, generation])

  // Stryker disable next-line ArithmeticOperator: any change to the counter re-runs the effect; the direction is irrelevant
  const reload = () => setGeneration((value) => value + 1)

  // Every action reports success as a boolean so a form can close itself on true; a failure is
  // shown once, here, instead of each caller rendering its own copy of the same banner.
  const attempt = useCallback(async (action: () => Promise<void>) => {
    setActionError(null)
    try {
      await action()
      return true
    } catch (error) {
      setActionError(errorMessage(error))
      return false
    }
  }, [])

  const update = (change: (current: Board) => Board) => setBoard((current) => current && change(current))

  const actions: BoardActions = {
    addCard: (columnId, title) =>
      attempt(async () => {
        const card = await endpoints.createCard(columnId, { title, notes: '', due_at: null })
        update((current) => boards.addCard(current, card))
      }),
    saveCard: (cardId, fields) =>
      attempt(async () => {
        const card = await endpoints.updateCard(cardId, fields)
        update((current) => boards.replaceCard(current, card))
      }),
    deleteCard: (cardId) =>
      attempt(async () => {
        await endpoints.deleteCard(cardId)
        update((current) => boards.removeCard(current, cardId))
      }),
    // Optimistic: the card is already where it was dropped before the request goes out. If the
    // server refuses, the board is reloaded rather than unwound by hand - the server's order is
    // the truth, and the local guess may have raced another change.
    moveCard: async (cardId, placement) => {
      update((current) => boards.moveCardLocally(current, cardId, placement))
      const moved = await attempt(async () => {
        await endpoints.moveCard(cardId, placement.columnId, placement.index)
      })
      if (!moved) reload()
      return moved
    },
    addColumn: (name) =>
      attempt(async () => {
        const column = await endpoints.createColumn(boardId, name)
        update((current) => boards.addColumn(current, column))
      }),
    renameColumn: (columnId, name) =>
      attempt(async () => {
        setBoard(await endpoints.renameColumn(columnId, name))
      }),
    moveColumn: (columnId, index) =>
      attempt(async () => {
        setBoard(await endpoints.moveColumn(columnId, index))
      }),
    deleteColumn: (columnId) =>
      attempt(async () => {
        await endpoints.deleteColumn(columnId)
        update((current) => boards.removeColumn(current, columnId))
      }),
    renameBoard: (name) =>
      attempt(async () => {
        const renamed = await endpoints.renameBoard(boardId, name)
        update((current) => ({ ...current, name: renamed.name }))
      }),
  }

  return { board, loadError, actionError, dismissError: () => setActionError(null), reload, actions }
}
