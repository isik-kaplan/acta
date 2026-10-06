import { useCallback, useEffect, useState } from 'react'

import * as endpoints from '../api/endpoints'
import type { PushSubscriptionJSON } from '../api/types'
import { errorMessage } from '../lib/errors'
import { decodeServerKey } from '../lib/push'

export type PushState = 'unsupported' | 'checking' | 'denied' | 'off' | 'on'

export interface PushNotifications {
  state: PushState
  isBusy: boolean
  error: string | null
  notice: string | null
  enable: () => Promise<void>
  disable: () => Promise<void>
  sendTest: () => Promise<void>
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function asJSON(subscription: PushSubscription): PushSubscriptionJSON {
  return subscription.toJSON() as PushSubscriptionJSON
}

export function usePushNotifications(): PushNotifications {
  const [state, setState] = useState<PushState>(() => (isPushSupported() ? 'checking' : 'unsupported'))
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!isPushSupported()) return
    // getRegistration, not .ready: `ready` never settles while no worker is registered at all, and
    // this would sit on "Checking" forever.
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.pushManager.getSubscription() ?? null)
      .then((subscription) => {
        if (Notification.permission === 'denied') {
          setState('denied')
        } else if (subscription) {
          setState('on')
          // Re-sent on every visit: the server may not know this device (a new login on it, a
          // database reset) while the browser still holds the subscription. It's an upsert, so a
          // device it already knows costs nothing.
          endpoints.savePushSubscription(asJSON(subscription)).catch(() => {})
        } else {
          setState('off')
        }
      })
  }, [])

  const run = useCallback(async (action: () => Promise<void>) => {
    setIsBusy(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof DOMException ? caught.message : errorMessage(caught))
    } finally {
      setIsBusy(false)
    }
  }, [])

  const enable = () =>
    run(async () => {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const { public_key } = await endpoints.fetchPushKey()
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeServerKey(public_key),
      })
      await endpoints.savePushSubscription(asJSON(subscription))
      setState('on')
    })

  const disable = () =>
    run(async () => {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await endpoints.removePushSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setState('off')
    })

  const sendTest = () =>
    run(async () => {
      const { sent } = await endpoints.sendTestPush()
      setNotice(
        sent === 0
          ? 'No devices are subscribed yet. Turn notifications on first.'
          : `Sent to ${sent} ${sent === 1 ? 'device' : 'devices'}.`
      )
    })

  return { state, isBusy, error, notice, enable, disable, sendTest }
}
