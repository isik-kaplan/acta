import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/api/client'
import * as endpoints from '../../src/api/endpoints'
import { isPushSupported, usePushNotifications } from '../../src/hooks/usePushNotifications'
import { SUBSCRIPTION_JSON, installPush, uninstallPush } from '../testUtils/push'

vi.mock('../../src/api/endpoints')

beforeEach(() => {
  vi.mocked(endpoints.savePushSubscription).mockReset().mockResolvedValue(undefined)
  vi.mocked(endpoints.removePushSubscription).mockReset().mockResolvedValue(undefined)
  vi.mocked(endpoints.fetchPushKey).mockReset().mockResolvedValue({ public_key: 'AQID' })
  vi.mocked(endpoints.sendTestPush).mockReset()
})

afterEach(() => {
  uninstallPush()
})

async function settled() {
  const hook = renderHook(() => usePushNotifications())
  await waitFor(() => expect(hook.result.current.state).not.toBe('checking'))
  return hook
}

describe('isPushSupported', () => {
  it('needs a service worker, PushManager and Notification', () => {
    expect(isPushSupported()).toBe(false)
    installPush()
    expect(isPushSupported()).toBe(true)
    vi.unstubAllGlobals()
    expect(isPushSupported()).toBe(false)
  })

  it('is false without a service worker even when the other two exist', () => {
    installPush()
    uninstallPush()
    expect(isPushSupported()).toBe(false)
  })

  it('is false without Notification', () => {
    installPush()
    vi.stubGlobal('Notification', undefined)
    Reflect.deleteProperty(window, 'Notification')
    expect(isPushSupported()).toBe(false)
  })
})

describe('usePushNotifications', () => {
  it('is unsupported, and stays that way, where the browser lacks push', async () => {
    const { result } = renderHook(() => usePushNotifications())
    expect(result.current.state).toBe('unsupported')
    expect(result.current.isBusy).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.notice).toBeNull()
  })

  it('is off on a device with no subscription', async () => {
    installPush()
    const { result } = renderHook(() => usePushNotifications())
    expect(result.current.state).toBe('checking')
    await waitFor(() => expect(result.current.state).toBe('off'))
    expect(endpoints.savePushSubscription).not.toHaveBeenCalled()
  })

  it('is off when no worker is registered yet', async () => {
    installPush({ registered: false })
    const { result } = await settled()
    expect(result.current.state).toBe('off')
  })

  it('is on, and re-sends the subscription, on a subscribed device', async () => {
    installPush({ permission: 'granted', subscribed: true })
    const { result } = await settled()
    expect(result.current.state).toBe('on')
    expect(endpoints.savePushSubscription).toHaveBeenCalledWith(SUBSCRIPTION_JSON)
  })

  it('ignores a failed re-send', async () => {
    installPush({ permission: 'granted', subscribed: true })
    vi.mocked(endpoints.savePushSubscription).mockRejectedValue(new ApiError('Nope.', 500))
    const { result } = await settled()
    expect(result.current.state).toBe('on')
    expect(result.current.error).toBeNull()
  })

  it('is denied when the user blocked notifications, subscription or not', async () => {
    installPush({ permission: 'denied', subscribed: true })
    const { result } = await settled()
    expect(result.current.state).toBe('denied')
    expect(endpoints.savePushSubscription).not.toHaveBeenCalled()
  })

  it('enable asks permission, subscribes with the server key and saves the subscription', async () => {
    const { pushManager, Notification } = installPush()
    const { result } = await settled()
    await act(() => result.current.enable())
    expect(Notification.requestPermission).toHaveBeenCalled()
    const options = pushManager.subscribe.mock.calls[0][0]
    expect(options.userVisibleOnly).toBe(true)
    expect([...options.applicationServerKey]).toEqual([1, 2, 3])
    expect(endpoints.savePushSubscription).toHaveBeenCalledWith(SUBSCRIPTION_JSON)
    expect(result.current.state).toBe('on')
    expect(result.current.isBusy).toBe(false)
  })

  it('enable stops at a refused permission', async () => {
    const { pushManager, Notification } = installPush()
    Notification.requestPermission.mockResolvedValue('denied')
    const { result } = await settled()
    await act(() => result.current.enable())
    expect(result.current.state).toBe('denied')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('enable stays off when the permission prompt is dismissed', async () => {
    const { pushManager, Notification } = installPush()
    Notification.requestPermission.mockResolvedValue('default')
    const { result } = await settled()
    await act(() => result.current.enable())
    expect(result.current.state).toBe('off')
    expect(pushManager.subscribe).not.toHaveBeenCalled()
  })

  it("enable shows the browser's own message when subscribing fails", async () => {
    const { pushManager } = installPush()
    pushManager.subscribe.mockRejectedValue(new DOMException('Registration failed - push service error', 'AbortError'))
    const { result } = await settled()
    await act(() => result.current.enable())
    expect(result.current.error).toBe('Registration failed - push service error')
    expect(result.current.state).toBe('off')
    expect(result.current.isBusy).toBe(false)
  })

  it('enable shows the server message when saving fails', async () => {
    installPush()
    vi.mocked(endpoints.savePushSubscription).mockRejectedValue(new ApiError('Nope.', 500))
    const { result } = await settled()
    await act(() => result.current.enable())
    expect(result.current.error).toBe('Nope.')
  })

  it('is busy while an action runs', async () => {
    const { Notification } = installPush()
    let answer: (value: string) => void = () => {}
    Notification.requestPermission.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const { result } = await settled()
    let pending: Promise<void>
    act(() => {
      pending = result.current.enable()
    })
    expect(result.current.isBusy).toBe(true)
    await act(async () => {
      answer('default')
      await pending
    })
    expect(result.current.isBusy).toBe(false)
  })

  it('disable forgets the device on the server, then unsubscribes the browser', async () => {
    const { subscription } = installPush({ permission: 'granted', subscribed: true })
    const { result } = await settled()
    await act(() => result.current.disable())
    expect(endpoints.removePushSubscription).toHaveBeenCalledWith(SUBSCRIPTION_JSON.endpoint)
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(result.current.state).toBe('off')
  })

  it('disable with no subscription left just turns off', async () => {
    const { pushManager, subscription } = installPush({ permission: 'granted', subscribed: true })
    const { result } = await settled()
    pushManager.getSubscription.mockResolvedValue(null)
    await act(() => result.current.disable())
    expect(endpoints.removePushSubscription).not.toHaveBeenCalled()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
    expect(result.current.state).toBe('off')
  })

  it('disable keeps the browser subscribed when the server call fails', async () => {
    const { subscription } = installPush({ permission: 'granted', subscribed: true })
    vi.mocked(endpoints.removePushSubscription).mockRejectedValue(new ApiError('Nope.', 500))
    const { result } = await settled()
    await act(() => result.current.disable())
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
    expect(result.current.state).toBe('on')
    expect(result.current.error).toBe('Nope.')
  })

  it.each([
    [0, 'No devices are subscribed yet. Turn notifications on first.'],
    [1, 'Sent to 1 device.'],
    [3, 'Sent to 3 devices.'],
  ])('sendTest to %i devices says so', async (sent, notice) => {
    installPush({ permission: 'granted', subscribed: true })
    vi.mocked(endpoints.sendTestPush).mockResolvedValue({ sent })
    const { result } = await settled()
    await act(() => result.current.sendTest())
    expect(result.current.notice).toBe(notice)
  })

  it('a new action clears the previous notice and error', async () => {
    installPush({ permission: 'granted', subscribed: true })
    vi.mocked(endpoints.sendTestPush)
      .mockResolvedValueOnce({ sent: 1 })
      .mockRejectedValueOnce(new ApiError('Nope.', 500))
    const { result } = await settled()
    await act(() => result.current.sendTest())
    await act(() => result.current.sendTest())
    expect(result.current.notice).toBeNull()
    expect(result.current.error).toBe('Nope.')
    vi.mocked(endpoints.sendTestPush).mockResolvedValueOnce({ sent: 1 })
    await act(() => result.current.sendTest())
    expect(result.current.error).toBeNull()
  })
})
