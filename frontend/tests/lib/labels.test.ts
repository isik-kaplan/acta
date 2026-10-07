import { describe, expect, it } from 'vitest'

import { LABEL_COLORS, findLabelByName, matchesFilter } from '../../src/lib/labels'
import { LABELS, card } from '../testUtils/fixtures'

describe('matchesFilter', () => {
  const tagged = card('k', 'todo', 0, { labels: ['l-home', 'l-errand'] })
  const plain = card('plain', 'todo', 0)
  const any = (labels: string[]) => ({ labels, match: 'any' as const })
  const all = (labels: string[]) => ({ labels, match: 'all' as const })

  it('lets every card through when nothing is filtered', () => {
    for (const filter of [any([]), all([])]) {
      expect(matchesFilter(tagged, filter)).toBe(true)
      expect(matchesFilter(plain, filter)).toBe(true)
    }
  })

  it('lets a card through when it has any one of the filtered labels', () => {
    expect(matchesFilter(tagged, any(['l-errand']))).toBe(true)
    expect(matchesFilter(tagged, any(['l-urgent', 'l-home']))).toBe(true)
  })

  it('holds back a card with none of them', () => {
    expect(matchesFilter(tagged, any(['l-urgent']))).toBe(false)
    expect(matchesFilter(plain, any(['l-urgent']))).toBe(false)
  })

  it('needs every filtered label when matching all', () => {
    expect(matchesFilter(tagged, all(['l-home', 'l-errand']))).toBe(true)
    expect(matchesFilter(tagged, all(['l-errand']))).toBe(true)
    expect(matchesFilter(tagged, all(['l-home', 'l-urgent']))).toBe(false)
    expect(matchesFilter(plain, all(['l-home']))).toBe(false)
  })
})

describe('findLabelByName', () => {
  it('finds a label ignoring case and surrounding spaces', () => {
    expect(findLabelByName(LABELS, '  hOmE ')).toBe(LABELS[1])
  })

  it('finds nothing for a name the board does not have', () => {
    expect(findLabelByName(LABELS, 'Homework')).toBeUndefined()
    expect(findLabelByName([], 'Home')).toBeUndefined()
  })
})

describe('LABEL_COLORS', () => {
  it('lists each colour once', () => {
    expect(new Set(LABEL_COLORS).size).toBe(LABEL_COLORS.length)
    expect(LABEL_COLORS).toHaveLength(19)
  })
})
