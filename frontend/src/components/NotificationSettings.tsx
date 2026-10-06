import { usePushNotifications } from '../hooks/usePushNotifications'

const DESCRIPTIONS = {
  unsupported:
    "This browser can't receive notifications. On iPhone and iPad, add acta to your Home Screen first and open it from there.",
  checking: 'Checking this device…',
  denied: 'Notifications are blocked for acta. Allow them in your browser or system settings, then come back.',
  off: 'Get a notification on this device when a card is due.',
  on: 'This device gets a notification when a card is due.',
}

export default function NotificationSettings() {
  const { state, isBusy, error, notice, enable, disable, sendTest } = usePushNotifications()

  return (
    <section className="settings-section" aria-labelledby="notifications-title">
      <h2 id="notifications-title" className="settings-section__title">
        Notifications
      </h2>
      <p className="settings-section__text">{DESCRIPTIONS[state]}</p>
      {error && <div className="banner banner--error">{error}</div>}
      {notice && (
        <div className="banner banner--success" role="status">
          {notice}
        </div>
      )}
      <div className="settings-section__actions">
        {state === 'off' && (
          <button type="button" className="btn btn--primary" onClick={enable} disabled={isBusy}>
            Turn on for this device
          </button>
        )}
        {state === 'on' && (
          <>
            <button type="button" className="btn" onClick={sendTest} disabled={isBusy}>
              Send a test
            </button>
            <button type="button" className="btn btn--ghost" onClick={disable} disabled={isBusy}>
              Turn off
            </button>
          </>
        )}
      </div>
    </section>
  )
}
