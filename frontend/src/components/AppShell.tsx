import { Link, Outlet, useLocation } from 'react-router'

import { useAuth } from '../hooks/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import Brand from './Brand'

// "Board" is whichever board is open - so it owns "/" and every /boards/:id, while "Boards" is only
// the list itself. NavLink's prefix matching would light both up on a board, hence by hand.
const NAV_ITEMS = [
  // Stryker disable next-line StringLiteral: AppShell is the root layout route, where an empty path resolves to "/" too
  { to: '/', label: 'Board', isActive: (path: string) => path === '/' || path.startsWith('/boards/') },
  { to: '/boards', label: 'Boards', isActive: (path: string) => path === '/boards' },
  { to: '/settings', label: 'Settings', isActive: (path: string) => path === '/settings' },
]

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" strokeLinecap="square" />
      <path d="M15 16l4-4-4-4" strokeLinecap="square" />
      <path d="M19 12H9" strokeLinecap="square" />
    </svg>
  )
}

function NavLinks({ itemClass }: { itemClass: string }) {
  const { pathname } = useLocation()
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = item.isActive(pathname)
        return (
          <Link
            key={item.to}
            to={item.to}
            className={active ? `${itemClass} is-active` : itemClass}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}

export default function AppShell() {
  const { user, logout } = useAuth()
  const isOnline = useOnlineStatus()

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Primary">
        <Brand />
        <div className="app-nav__links">
          <NavLinks itemClass="app-nav__link" />
        </div>
        <div className="app-nav__user">
          {/* Only ever rendered inside RequireAuth, so there's always a user. */}
          <span className="app-nav__name">{user!.display_name}</span>
          <button
            type="button"
            className="btn btn--ghost btn--icon btn--small"
            onClick={() => logout()}
            aria-label="Log out"
            title="Log out"
          >
            <LogoutIcon />
          </button>
        </div>
      </nav>

      <main className="app-main">
        {!isOnline && (
          <div className="banner banner--warning" role="status">
            You're offline. Changes won't save until you're back.
          </div>
        )}
        <Outlet />
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <NavLinks itemClass="app-tabbar__link" />
      </nav>
    </div>
  )
}
