import { useEffect, useState } from 'react'

/** The current time, refreshed every `intervalMs` - so a card left on screen turns overdue on its
 * own instead of waiting for something else to re-render it. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
