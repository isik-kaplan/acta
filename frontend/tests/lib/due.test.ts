import { describe, expect, it } from 'vitest'

import { dueStatus, formatDue, fromLocalInput, toLocalInput } from '../../src/lib/due'

// Tests run with TZ=UTC (vitest.config.ts), so local time and UTC coincide here.
const NOW = new Date('2026-10-06T12:00:00Z')

describe('dueStatus', () => {
  it('is overdue from the due moment on', () => {
    expect(dueStatus('2026-10-06T12:00:00Z', NOW)).toBe('overdue')
    expect(dueStatus('2026-10-01T09:00:00Z', NOW)).toBe('overdue')
  })

  it('is today for later the same day', () => {
    expect(dueStatus('2026-10-06T12:00:01Z', NOW)).toBe('today')
    expect(dueStatus('2026-10-06T23:59:00Z', NOW)).toBe('today')
  })

  it('is later from tomorrow on', () => {
    expect(dueStatus('2026-10-07T00:00:00Z', NOW)).toBe('later')
    expect(dueStatus('2027-01-01T00:00:00Z', NOW)).toBe('later')
  })
})

describe('formatDue', () => {
  it.each([
    ['2026-10-06T09:05:00Z', 'Today 09:05'],
    ['2026-10-07T18:30:00Z', 'Tomorrow 18:30'],
    ['2026-10-05T07:00:00Z', 'Yesterday 07:00'],
    ['2026-10-08T07:00:00Z', '8 Oct 07:00'],
    ['2026-10-04T07:00:00Z', '4 Oct 07:00'],
    ['2027-02-01T07:00:00Z', '1 Feb 2027 07:00'],
    ['2025-12-31T23:00:00Z', '31 Dec 2025 23:00'],
  ])('%s reads as %s', (dueAt, expected) => {
    expect(formatDue(dueAt, NOW)).toBe(expected)
  })
})

describe('datetime-local conversion', () => {
  it('shows an instant as a zero-padded local value', () => {
    expect(toLocalInput('2026-03-04T05:06:00Z')).toBe('2026-03-04T05:06')
    expect(toLocalInput('2026-11-24T15:45:00Z')).toBe('2026-11-24T15:45')
  })

  it('reads a local value back to an instant', () => {
    expect(fromLocalInput('2026-03-04T05:06')).toBe('2026-03-04T05:06:00.000Z')
  })

  it('reads an empty value as no due date', () => {
    expect(fromLocalInput('')).toBeNull()
  })
})
