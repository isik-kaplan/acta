import { api } from './client'
import type { Board, BoardSummary, Card, CardFields, Column, PushSubscriptionJSON, User } from './types'

export const fetchCurrentUser = () => api.get<User>('/auth/me')
export const login = (email: string, password: string) => api.post<User>('/auth/login', { email, password })
export const register = (email: string, password: string, displayName: string) =>
  api.post<User>('/auth/register', { email, password, display_name: displayName })
export const logout = () => api.post<void>('/auth/logout')
export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post<void>('/account/password', { current_password: currentPassword, new_password: newPassword })

export const fetchBoards = () => api.get<BoardSummary[]>('/boards')
export const fetchBoard = (boardId: string) => api.get<Board>(`/boards/${boardId}`)
export const createBoard = (name: string) => api.post<BoardSummary>('/boards', { name })
export const renameBoard = (boardId: string, name: string) => api.patch<BoardSummary>(`/boards/${boardId}`, { name })
export const deleteBoard = (boardId: string) => api.delete<void>(`/boards/${boardId}`)

export const createColumn = (boardId: string, name: string) => api.post<Column>(`/boards/${boardId}/columns`, { name })
export const renameColumn = (columnId: string, name: string) => api.patch<Board>(`/columns/${columnId}`, { name })
export const moveColumn = (columnId: string, index: number) => api.post<Board>(`/columns/${columnId}/move`, { index })
export const deleteColumn = (columnId: string) => api.delete<void>(`/columns/${columnId}`)

export const createCard = (columnId: string, fields: CardFields) => api.post<Card>(`/columns/${columnId}/cards`, fields)
export const updateCard = (cardId: string, fields: CardFields) => api.put<Card>(`/cards/${cardId}`, fields)
export const moveCard = (cardId: string, columnId: string, index: number) =>
  api.post<Card>(`/cards/${cardId}/move`, { column_id: columnId, index })
export const deleteCard = (cardId: string) => api.delete<void>(`/cards/${cardId}`)

export const fetchPushKey = () => api.get<{ public_key: string }>('/push/public-key')
export const savePushSubscription = (subscription: PushSubscriptionJSON) =>
  api.post<void>('/push/subscriptions', subscription)
export const removePushSubscription = (endpoint: string) => api.post<void>('/push/unsubscribe', { endpoint })
export const sendTestPush = () => api.post<{ sent: number }>('/push/test')
