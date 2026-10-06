import type { ReactNode } from 'react'

import { Navigate, Route, Routes } from 'react-router'

import AppShell from './components/AppShell'
import ConnectionError from './components/ConnectionError'
import { useAuth } from './hooks/useAuth'
import BoardPage from './pages/BoardPage'
import Boards from './pages/Boards'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Settings from './pages/Settings'

/** Gates a route on the auth check: offline and loading look the same either way, and then only
 * the right kind of visitor (`wantsUser`) gets in - everyone else is sent where they belong. */
function Gate({ wantsUser, children }: { wantsUser: boolean; children: ReactNode }) {
  const { user, isLoading, isOffline, retryConnection } = useAuth()

  if (isOffline) return <ConnectionError onRetry={retryConnection} />
  if (isLoading) return <div className="centered-loader">Loading…</div>
  if (Boolean(user) !== wantsUser) return <Navigate to={wantsUser ? '/login' : '/'} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Gate wantsUser={false}>
            <Login />
          </Gate>
        }
      />
      <Route
        path="/register"
        element={
          <Gate wantsUser={false}>
            <Register />
          </Gate>
        }
      />
      <Route
        element={
          <Gate wantsUser>
            <AppShell />
          </Gate>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/boards" element={<Boards />} />
        <Route path="/boards/:boardId" element={<BoardPage />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
