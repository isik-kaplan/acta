import { vi } from 'vitest'

export const SUBSCRIPTION_JSON = { endpoint: 'https://push.example/device', keys: { p256dh: 'p', auth: 'a' } }

/** Stands in for the browser's push stack - jsdom has no service worker, PushManager or
 * Notification at all. Returns the fakes so a test can steer and inspect them. */
export function installPush({
  permission = 'default' as NotificationPermission,
  subscribed = false,
  registered = true,
} = {}) {
  const subscription = {
    endpoint: SUBSCRIPTION_JSON.endpoint,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(subscribed ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  }
  const registration = { pushManager }
  const serviceWorker = {
    ready: Promise.resolve(registration),
    getRegistration: vi.fn().mockResolvedValue(registered ? registration : undefined),
  }
  const Notification = { permission, requestPermission: vi.fn().mockResolvedValue('granted') }
  vi.stubGlobal('Notification', Notification)
  vi.stubGlobal('PushManager', function PushManager() {})
  Object.defineProperty(navigator, 'serviceWorker', { value: serviceWorker, configurable: true })
  return { subscription, pushManager, serviceWorker, Notification }
}

export function uninstallPush() {
  Reflect.deleteProperty(navigator, 'serviceWorker')
}
