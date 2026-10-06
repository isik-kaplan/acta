import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '../src/App'
import { mockAuth } from './testUtils/auth'

vi.mock('../src/hooks/useAuth')
vi.mock('../src/components/AppShell', async () => {
  const { Outlet } = await import('react-router')
  return {
    default: () => (
      <div data-testid="shell">
        <Outlet />
      </div>
    ),
  }
})
vi.mock('../src/pages/Home', () => ({ default: () => <p>home page</p> }))
vi.mock('../src/pages/Boards', () => ({ default: () => <p>boards page</p> }))
vi.mock('../src/pages/BoardPage', () => ({ default: () => <p>board page</p> }))
vi.mock('../src/pages/Settings', () => ({ default: () => <p>settings page</p> }))
vi.mock('../src/pages/Login', () => ({ default: () => <p>login page</p> }))
vi.mock('../src/pages/Register', () => ({ default: () => <p>register page</p> }))

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Where />
    </MemoryRouter>
  )
}

beforeEach(() => {
  mockAuth()
})

describe('App routes for a signed-in user', () => {
  it.each([
    ['/', 'home page'],
    ['/boards', 'boards page'],
    ['/boards/b1', 'board page'],
    ['/settings', 'settings page'],
  ])('%s shows the %s inside the shell', (path, text) => {
    renderAt(path)
    expect(screen.getByTestId('shell')).toHaveTextContent(text)
  })

  it.each(['/login', '/register'])('%s sends you home', (path) => {
    renderAt(path)
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/)
  })

  it('sends an unknown path home', () => {
    renderAt('/nowhere')
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/)
    expect(screen.getByText('home page')).toBeInTheDocument()
  })
})

describe('App routes for a visitor', () => {
  it.each([
    ['/login', 'login page'],
    ['/register', 'register page'],
  ])('%s shows the %s', (path, text) => {
    mockAuth({ user: null })
    renderAt(path)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByTestId('shell')).toBeNull()
  })

  it.each(['/', '/boards', '/settings'])('%s sends you to login', (path) => {
    mockAuth({ user: null })
    renderAt(path)
    expect(screen.getByTestId('where')).toHaveTextContent('/login')
    expect(screen.getByText('login page')).toBeInTheDocument()
  })
})

describe('App while the session is unknown', () => {
  it.each(['/', '/login'])('%s shows a loader while checking', (path) => {
    mockAuth({ user: null, isLoading: true })
    renderAt(path)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent(path)
  })

  it.each(['/', '/login'])('%s shows the connection error when offline, and retries', async (path) => {
    const auth = mockAuth({ user: null, isOffline: true, isLoading: true })
    renderAt(path)
    expect(screen.getByRole('heading', { name: "Can't connect" })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(auth.retryConnection).toHaveBeenCalled()
  })
})
