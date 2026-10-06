import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/api/client'
import * as endpoints from '../../src/api/endpoints'
import Brand from '../../src/components/Brand'
import ConnectionError from '../../src/components/ConnectionError'
import NotificationSettings from '../../src/components/NotificationSettings'
import PasswordForm from '../../src/components/PasswordForm'
import { usePushNotifications } from '../../src/hooks/usePushNotifications'
import type { PushNotifications, PushState } from '../../src/hooks/usePushNotifications'

vi.mock('../../src/api/endpoints')
vi.mock('../../src/hooks/usePushNotifications')

function push(state: PushState, overrides: Partial<PushNotifications> = {}): PushNotifications {
  const value = {
    state,
    isBusy: false,
    error: null,
    notice: null,
    enable: vi.fn(),
    disable: vi.fn(),
    sendTest: vi.fn(),
    ...overrides,
  }
  vi.mocked(usePushNotifications).mockReturnValue(value)
  return value
}

describe('NotificationSettings', () => {
  it.each([
    [
      'unsupported',
      "This browser can't receive notifications. On iPhone and iPad, add acta to your Home Screen first and open it from there.",
    ],
    ['checking', 'Checking this device…'],
    ['denied', 'Notifications are blocked for acta. Allow them in your browser or system settings, then come back.'],
  ] as const)('explains the %s state and offers no buttons', (state, text) => {
    push(state)
    render(<NotificationSettings />)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('offers to turn on when off', async () => {
    const value = push('off')
    render(<NotificationSettings />)
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('Get a notification on this device when a card is due.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Turn on for this device' }))
    expect(value.enable).toHaveBeenCalled()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('offers a test and turning off when on', async () => {
    const value = push('on')
    render(<NotificationSettings />)
    expect(screen.getByText('This device gets a notification when a card is due.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Send a test' }))
    expect(value.sendTest).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(value.disable).toHaveBeenCalled()
  })

  it('disables its buttons while busy', () => {
    push('on', { isBusy: true })
    const { unmount } = render(<NotificationSettings />)
    expect(screen.getByRole('button', { name: 'Send a test' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeDisabled()
    unmount()
    push('off', { isBusy: true })
    render(<NotificationSettings />)
    expect(screen.getByRole('button', { name: 'Turn on for this device' })).toBeDisabled()
  })

  it('shows the error and the notice', () => {
    push('on', { error: 'Nope.', notice: 'Sent to 1 device.' })
    render(<NotificationSettings />)
    expect(screen.getByText('Nope.')).toHaveClass('banner--error')
    expect(screen.getByRole('status')).toHaveTextContent('Sent to 1 device.')
  })
})

describe('PasswordForm', () => {
  beforeEach(() => {
    vi.mocked(endpoints.changePassword).mockReset()
  })

  async function submit(current: string, next: string) {
    await userEvent.type(screen.getByLabelText('Current password'), current)
    await userEvent.type(screen.getByLabelText('New password'), next)
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
  }

  it('changes the password, empties the fields and says so', async () => {
    vi.mocked(endpoints.changePassword).mockResolvedValue(undefined)
    render(<PasswordForm />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelector('.banner')).toBeNull()
    expect(screen.getByLabelText('New password')).toHaveAttribute('minlength', '8')
    await submit('old-password', 'new-password')
    expect(endpoints.changePassword).toHaveBeenCalledWith('old-password', 'new-password')
    expect(screen.getByRole('status')).toHaveTextContent('Password changed.')
    expect(screen.getByLabelText('Current password')).toHaveValue('')
    expect(screen.getByLabelText('New password')).toHaveValue('')
  })

  it('shows the server error and keeps what was typed', async () => {
    vi.mocked(endpoints.changePassword).mockRejectedValue(new ApiError('Current password is incorrect.', 401))
    render(<PasswordForm />)
    await submit('wrong', 'new-password')
    expect(screen.getByText('Current password is incorrect.')).toBeInTheDocument()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByLabelText('Current password')).toHaveValue('wrong')
  })

  it('clears the previous outcome on the next try, and is disabled while submitting', async () => {
    let finish: () => void = () => {}
    vi.mocked(endpoints.changePassword)
      .mockRejectedValueOnce(new ApiError('Current password is incorrect.', 401))
      .mockReturnValueOnce(new Promise((resolve) => (finish = () => resolve(undefined))))
    render(<PasswordForm />)
    await submit('wrong', 'new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.queryByText('Current password is incorrect.')).toBeNull()
    expect(screen.getByRole('button', { name: 'Change password' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Change password' }).querySelector('.btn__spinner')).not.toBeNull()
    finish()
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed.')
    expect(screen.getByRole('button', { name: 'Change password' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Change password' }).querySelector('.btn__spinner')).toBeNull()
  })

  it('hides a previous success on the next try', async () => {
    vi.mocked(endpoints.changePassword)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError('Nope.', 500))
    render(<PasswordForm />)
    await submit('a', 'new-password')
    await submit('b', 'new-password')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('PasswordForm initial state', () => {
  it('starts both fields as empty strings', async () => {
    vi.mocked(endpoints.changePassword).mockReset().mockResolvedValue(undefined)
    render(<PasswordForm />)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Change password' }).closest('form')!)
    expect(endpoints.changePassword).toHaveBeenCalledWith('', 'new-password')
    await screen.findByRole('status')
  })
})

describe('Brand and ConnectionError', () => {
  afterEach(() => vi.restoreAllMocks())

  it('Brand is the wordmark with a hidden glyph, classed as asked', () => {
    const { container } = render(<Brand />)
    expect(container.firstChild).toHaveAttribute('class', 'brand')
    expect(container.firstChild).toHaveTextContent(/^acta$/)
    expect(container.querySelector('.brand__mark')).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelectorAll('.brand__mark span')).toHaveLength(3)
  })

  it('ConnectionError explains and retries', async () => {
    const onRetry = vi.fn()
    render(<ConnectionError onRetry={onRetry} />)
    expect(screen.getByRole('heading', { name: "Can't connect" })).toBeInTheDocument()
    expect(screen.getByText("acta couldn't reach the server. Check your connection and try again.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })
})
