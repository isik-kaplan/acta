import Brand from './Brand'

// Shown in place of the whole app when the very first request - the auth check every route gates
// on - can't reach the server. Once inside, a dropped connection shows AppShell's inline banner
// instead, since by then there's a board on screen worth keeping.
export default function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand className="brand brand--large" />
        <h1>Can't connect</h1>
        <p className="auth-card__subtitle">acta couldn't reach the server. Check your connection and try again.</p>
        <button type="button" className="btn btn--primary btn--block" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  )
}
