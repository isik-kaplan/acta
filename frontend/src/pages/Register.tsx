import { useState } from 'react'
import type { FormEvent } from 'react'

import { useFormState } from '@isik-kaplan/core/hooks'
import { Link, useNavigate } from 'react-router'

import Brand from '../components/Brand'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../lib/errors'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const { formState, handleFormStateEvent } = useFormState({ display_name: '', email: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await register(formState.email, formState.password, formState.display_name)
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
        <h1>Create your account</h1>
        <p className="auth-card__subtitle">One board to start, with To do, Doing and Done.</p>

        {error && <div className="banner banner--error">{error}</div>}

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="display_name">Name</label>
            <input
              id="display_name"
              className="input"
              type="text"
              required
              autoComplete="name"
              value={formState.display_name}
              onChange={handleFormStateEvent('display_name')}
            />
          </div>
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
              minLength={8}
              autoComplete="new-password"
              value={formState.password}
              onChange={handleFormStateEvent('password')}
            />
            <span className="field__hint">At least 8 characters.</span>
          </div>
          <div className="form__actions">
            <button type="submit" className="btn btn--primary btn--block" disabled={isSubmitting}>
              {isSubmitting && <span className="btn__spinner" aria-hidden="true" />}
              Create account
            </button>
          </div>
        </form>

        <p className="auth-card__switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  )
}
