import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useNow } from '../../src/hooks/useNow'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-06T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useNow', () => {
  it('starts at the current time and ticks every 30 seconds by default', () => {
    const { result } = renderHook(() => useNow())
    expect(result.current.toISOString()).toBe('2026-10-06T12:00:00.000Z')
    act(() => vi.advanceTimersByTime(29_999))
    expect(result.current.toISOString()).toBe('2026-10-06T12:00:00.000Z')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.toISOString()).toBe('2026-10-06T12:00:30.000Z')
  })

  it('restarts its timer when the interval changes', () => {
    const { result, rerender } = renderHook(({ ms }) => useNow(ms), { initialProps: { ms: 60_000 } })
    rerender({ ms: 1000 })
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.toISOString()).toBe('2026-10-06T12:00:01.000Z')
  })

  it('takes its own interval and stops ticking once unmounted', () => {
    const { result, unmount } = renderHook(() => useNow(1000))
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.toISOString()).toBe('2026-10-06T12:00:01.000Z')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
