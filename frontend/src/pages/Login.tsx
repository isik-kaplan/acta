import { useState } from 'react'
import type { FormEvent } from 'react'

import { useFormState } from '@isik-kaplan/core/hooks'
import { Link, useNavigate } from 'react-router'

import Brand from '../components/Brand'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../lib/errors'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { formState, handleFormStateEvent } = useFormState({ email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(formState.email, formState.password)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand className="brand brand--large" />
        <h1>Log in</h1>
        <p className="auth-card__subtitle">Pick up where you left off.</p>

        {error && <div className="banner banner--error">{error}</div>}

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={formState.email}
              onChange={handleFormStateEvent('email')}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={formState.password}
              onChange={handleFormStateEvent('password')}
            />
          </div>
          <div className="form__actions">
            <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
              {isSubmitting && <span className="btn__spinner" aria-hidden="true" />}
              Log in
            </button>
          </div>
        </form>

        <p className="auth-card__switch">
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  )
}
