import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AppShell from '../../src/components/AppShell'
import { useAuth } from '../../src/hooks/useAuth'
import { useOnlineStatus } from '../../src/hooks/useOnlineStatus'
import { USER } from '../testUtils/fixtures'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/hooks/useOnlineStatus')

const logout = vi.fn()

beforeEach(() => {
  logout.mockReset()
  vi.mocked(useAuth).mockReturnValue({
    user: USER,
    isLoading: false,
    isOffline: false,
    retryConnection: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout,
    setUser: vi.fn(),
  })
  vi.mocked(useOnlineStatus).mockReturnValue(true)
})

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<p>page content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

// The desktop nav and the phone tab bar both render; CSS shows one or the other.
function activeLinks() {
  return screen
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => [link.textContent, link.className])
}

describe('AppShell', () => {
  it('renders the page inside the shell with the user name', () => {
    renderAt('/settings')
    expect(screen.getByText('page content')).toBeInTheDocument()
    expect(screen.getByText('Ada')).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(2)
  })

  it.each([
    ['/', 'Board'],
    ['/boards/b1', 'Board'],
    ['/boards', 'Boards'],
    ['/settings', 'Settings'],
  ])('at %s, marks %s active in both navs', (path, label) => {
    renderAt(path)
    expect(activeLinks()).toEqual([
      [label, 'app-nav__link is-active'],
      [label, 'app-tabbar__link is-active'],
    ])
  })

  it('leaves the other links plain', () => {
    renderAt('/settings')
    const plain = screen.getAllByRole('link', { name: 'Boards' })
    expect(plain.map((link) => link.className)).toEqual(['app-nav__link', 'app-tabbar__link'])
    expect(plain[0]).not.toHaveAttribute('aria-current')
    expect(plain[0]).toHaveAttribute('href', '/boards')
    expect(screen.getAllByRole('link', { name: 'Board' })[0]).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('link', { name: 'Settings' })[0]).toHaveAttribute('href', '/settings')
  })

  it('marks nothing active on an unknown path', () => {
    renderAt('/somewhere')
    expect(activeLinks()).toEqual([])
  })

  it('logs out', async () => {
    renderAt('/')
    expect(screen.getByRole('button', { name: 'Log out' }).querySelector('svg')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('shows an offline banner only while offline', () => {
    renderAt('/')
    expect(screen.queryByRole('status')).toBeNull()
    vi.mocked(useOnlineStatus).mockReturnValue(false)
    renderAt('/')
    expect(screen.getByRole('status')).toHaveTextContent("You're offline. Changes won't save until you're back.")
  })
})
