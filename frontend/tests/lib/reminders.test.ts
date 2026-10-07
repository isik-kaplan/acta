import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { collectReminders, toDraft, toMinutes } from '../../src/lib/reminders'

describe('toDraft', () => {
  it.each([
    [0, '0', 'minutes'],
    [1, '1', 'minutes'],
    [90, '90', 'minutes'],
    [60, '1', 'hours'],
    [1_500, '25', 'hours'],
    [1_440, '1', 'days'],
    [11_520, '8', 'days'],
    [10_080, '1', 'weeks'],
    [40_320, '4', 'weeks'],
  ])('%i minutes reads as %s %s', (minutes, amount, unit) => {
    expect(toDraft(minutes)).toEqual({ amount, unit })
  })

  it('round-trips every allowed value', () => {
    fc.assert(
      fc.property(fc.maxSafeNat(), (minutes) => {
        expect(toMinutes(toDraft(minutes))).toBe(minutes)
      })
    )
  })
})

describe('toMinutes', () => {
  it.each([
    ['10', 'minutes', 10],
    [' 2 ', 'hours', 120],
    ['3', 'days', 4_320],
    ['4', 'weeks', 40_320],
    ['0', 'weeks', 0],
    ['40320', 'minutes', 40_320],
    ['52', 'weeks', 524_160],
    ['1000000', 'weeks', 10_080_000_000],
    [String(Number.MAX_SAFE_INTEGER), 'minutes', Number.MAX_SAFE_INTEGER],
  ] as const)('%s %s is %i minutes', (amount, unit, minutes) => {
    expect(toMinutes({ amount, unit })).toBe(minutes)
  })

  it.each([
    ['', 'minutes'],
    ['  ', 'minutes'],
    ['-1', 'minutes'],
    ['1.5', 'hours'],
    ['1e2', 'minutes'],
    ['x1', 'minutes'],
    ['1x', 'minutes'],
    [String(Number.MAX_SAFE_INTEGER + 1), 'minutes'],
    [String(Math.ceil(Number.MAX_SAFE_INTEGER / 10_080)), 'weeks'],
  ] as const)('"%s" %s is not a reminder', (amount, unit) => {
    expect(toMinutes({ amount, unit })).toBeNull()
  })
})

describe('collectReminders', () => {
  it('keeps the valid ones, once each, smallest first', () => {
    expect(
      collectReminders([
        { amount: '1', unit: 'days' },
        { amount: '', unit: 'minutes' },
        { amount: '60', unit: 'minutes' },
        { amount: '1', unit: 'hours' },
        { amount: '0', unit: 'minutes' },
        { amount: '100', unit: 'minutes' },
      ])
    ).toEqual([0, 60, 100, 1_440])
  })

  it('is empty for none', () => {
    expect(collectReminders([])).toEqual([])
  })
})
