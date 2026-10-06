import { vi } from 'vitest'

import type { User } from '../../src/api/types'
import { useAuth } from '../../src/hooks/useAuth'
import { USER } from './fixtures'

type AuthValue = ReturnType<typeof useAuth>

/** Points the (already vi.mock'ed) useAuth at a fixed value; the test module must vi.mock it. */
export function mockAuth(overrides: Partial<AuthValue> & { user?: User | null } = {}): AuthValue {
  const value: AuthValue = {
    user: USER,
    isLoading: false,
    isOffline: false,
    retryConnection: vi.fn(),
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    setUser: vi.fn(),
    ...overrides,
  }
  vi.mocked(useAuth).mockReturnValue(value)
  return value
}
