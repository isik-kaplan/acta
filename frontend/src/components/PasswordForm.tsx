import { useState } from 'react'
import type { FormEvent } from 'react'

import { useFormState } from '@isik-kaplan/core/hooks'

import * as endpoints from '../api/endpoints'
import { errorMessage } from '../lib/errors'

export default function PasswordForm() {
  const { formState, handleFormStateEvent, resetFormState } = useFormState({ current: '', next: '' })
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsDone(false)
    setIsSubmitting(true)
    try {
      await endpoints.changePassword(formState.current, formState.next)
      resetFormState()
      setIsDone(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="settings-section" aria-labelledby="password-title">
      <h2 id="password-title" className="settings-section__title">
        Password
      </h2>
      {error && <div className="banner banner--error">{error}</div>}
      {isDone && (
        <div className="banner banner--success" role="status">
          Password changed.
        </div>
      )}
      <form className="form" onSubmit={handleSubmit}>
        <div className="form__row">
          <div className="field">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={formState.current}
              onChange={handleFormStateEvent('current')}
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={formState.next}
              onChange={handleFormStateEvent('next')}
            />
          </div>
        </div>
        <div className="form__actions">
          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting && <span className="btn__spinner" aria-hidden="true" />}
            Change password
          </button>
        </div>
      </form>
    </section>
  )
}
