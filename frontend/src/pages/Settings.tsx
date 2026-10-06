import NotificationSettings from '../components/NotificationSettings'
import PasswordForm from '../components/PasswordForm'
import ThemeToggle from '../components/ThemeToggle'
import { useAuth } from '../hooks/useAuth'

export default function Settings() {
  const { user, logout } = useAuth()

  return (
    <div className="page">
      <header className="page__header">
        <h1>Settings</h1>
        <span className="page__meta">{user!.email}</span>
      </header>

      <section className="settings-section" aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="settings-section__title">
          Appearance
        </h2>
        <ThemeToggle />
      </section>

      <NotificationSettings />
      <PasswordForm />

      <section className="settings-section settings-section--last">
        <button type="button" className="btn btn--danger" onClick={() => logout()}>
          Log out
        </button>
        <span className="page__meta numeral">acta {__APP_VERSION__}</span>
      </section>
    </div>
  )
}
