import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  // localStorage persists across tests within a file (theme, last board) - one test's writes
  // mustn't seed what another test's first render reads.
  localStorage.clear()
})
