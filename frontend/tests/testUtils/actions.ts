import { vi } from 'vitest'

import type { BoardActions } from '../../src/hooks/useBoard'

/** Every board action as a mock that succeeds, unless a test says otherwise. */
export function makeActions(overrides: Partial<BoardActions> = {}): BoardActions {
  return {
    addCard: vi.fn().mockResolvedValue(true),
    saveCard: vi.fn().mockResolvedValue(true),
    deleteCard: vi.fn().mockResolvedValue(true),
    moveCard: vi.fn().mockResolvedValue(true),
    addColumn: vi.fn().mockResolvedValue(true),
    renameColumn: vi.fn().mockResolvedValue(true),
    moveColumn: vi.fn().mockResolvedValue(true),
    deleteColumn: vi.fn().mockResolvedValue(true),
    renameBoard: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}
