import { describe, expect, it } from 'vitest'

import { readLastBoard, rememberLastBoard } from '../../src/lib/lastBoard'

describe('lastBoard', () => {
  it('is empty until a board is remembered, then returns the latest', () => {
    expect(readLastBoard()).toBeNull()
    rememberLastBoard('b1')
    rememberLastBoard('b2')
    expect(readLastBoard()).toBe('b2')
    expect(localStorage.getItem('acta-last-board')).toBe('b2')
  })
})
