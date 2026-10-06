import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import Settings from '../../src/pages/Settings'
import { mockAuth } from '../testUtils/auth'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'system', setTheme: vi.fn() }) }))
vi.mock('../../src/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({ state: 'off', isBusy: false, error: null, notice: null }),
}))

describe('Settings', () => {
  it('has every section, the account email and the version', () => {
    mockAuth()
    render(<Settings />)
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('ada@acta.local')).toBeInTheDocument()
    for (const name of ['Appearance', 'Notifications', 'Password']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('group', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByText('acta 0.0.0-test')).toBeInTheDocument()
  })

  it('logs out', async () => {
    const auth = mockAuth()
    render(<Settings />)
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(auth.logout).toHaveBeenCalledTimes(1)
  })
})
