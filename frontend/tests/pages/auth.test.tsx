import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ApiError, NetworkError } from '../../src/api/client'
import Login from '../../src/pages/Login'
import Register from '../../src/pages/Register'
import { mockAuth } from '../testUtils/auth'

vi.mock('../../src/hooks/useAuth')

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<p>Landed home</p>} />
      </Routes>
    </MemoryRouter>
  )
}

async function logIn(email = 'ada@acta.local', password = 'hunter22hunter') {
  await userEvent.type(screen.getByLabelText('Email'), email)
  await userEvent.type(screen.getByLabelText('Password'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
}

async function signUp() {
  await userEvent.type(screen.getByLabelText('Name'), 'Ada')
  await userEvent.type(screen.getByLabelText('Email'), 'ada@acta.local')
  await userEvent.type(screen.getByLabelText('Password'), 'hunter22hunter')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('Login', () => {
  it('starts empty, logs in with what was typed and goes home', async () => {
    const auth = mockAuth({ user: null })
    renderAt('/login')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveValue('')
    await logIn()
    expect(auth.login).toHaveBeenCalledWith('ada@acta.local', 'hunter22hunter')
    expect(await screen.findByText('Landed home')).toBeInTheDocument()
  })

  it.each([
    [new ApiError('Invalid email or password.', 401), 'Invalid email or password.'],
    [new NetworkError(), "Can't connect. Check your connection and try again."],
    [new Error('boom'), 'Something went wrong. Try again.'],
  ])('shows why it failed and stays put', async (error, message) => {
    mockAuth({ user: null, login: vi.fn().mockRejectedValue(error) })
    renderAt('/login')
    await logIn()
    expect(await screen.findByText(message)).toHaveClass('banner')
    expect(screen.queryByText('Landed home')).toBeNull()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Log in' }).querySelector('.btn__spinner')).toBeNull()
  })

  it('clears the old error and is disabled while trying again', async () => {
    let finish: () => void = () => {}
    mockAuth({
      user: null,
      login: vi
        .fn()
        .mockRejectedValueOnce(new ApiError('Invalid email or password.', 401))
        .mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve))),
    })
    renderAt('/login')
    await logIn()
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.queryByText('Invalid email or password.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Log in' }).querySelector('.btn__spinner')).not.toBeNull()
    finish()
    expect(await screen.findByText('Landed home')).toBeInTheDocument()
  })

  it('starts every field as an empty string, with no error shown', async () => {
    const auth = mockAuth({ user: null })
    renderAt('/login')
    expect(document.querySelector('.banner')).toBeNull()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter22hunter' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Log in' }).closest('form')!)
    expect(auth.login).toHaveBeenCalledWith('', 'hunter22hunter')
    await screen.findByText('Landed home')
  })

  it('links to registration', async () => {
    mockAuth({ user: null })
    renderAt('/login')
    await userEvent.click(screen.getByRole('link', { name: 'Create one' }))
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
  })
})

describe('Register', () => {
  it('starts empty, registers with what was typed and goes home', async () => {
    const auth = mockAuth({ user: null })
    renderAt('/register')
    for (const label of ['Name', 'Email', 'Password']) expect(screen.getByLabelText(label)).toHaveValue('')
    expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8')
    await signUp()
    expect(auth.register).toHaveBeenCalledWith('ada@acta.local', 'hunter22hunter', 'Ada')
    expect(await screen.findByText('Landed home')).toBeInTheDocument()
  })

  it('shows why it failed and clears that on the next try', async () => {
    let finish: () => void = () => {}
    mockAuth({
      user: null,
      register: vi
        .fn()
        .mockRejectedValueOnce(new ApiError('An account with this email already exists.', 403))
        .mockReturnValueOnce(new Promise<void>((resolve) => (finish = resolve))),
    })
    renderAt('/register')
    await signUp()
    expect(await screen.findByText('An account with this email already exists.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Create account' }).querySelector('.btn__spinner')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.queryByText('An account with this email already exists.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create account' }).querySelector('.btn__spinner')).not.toBeNull()
    finish()
    expect(await screen.findByText('Landed home')).toBeInTheDocument()
  })

  it('starts every field as an empty string, with no error shown', async () => {
    const auth = mockAuth({ user: null })
    renderAt('/register')
    expect(document.querySelector('.banner')).toBeNull()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter22hunter' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!)
    expect(auth.register).toHaveBeenCalledWith('', 'hunter22hunter', '')
    await screen.findByText('Landed home')
  })

  it('links back to login', async () => {
    mockAuth({ user: null })
    renderAt('/register')
    await userEvent.click(screen.getByRole('link', { name: 'Log in' }))
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument()
  })
})
