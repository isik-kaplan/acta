import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'

import { openNotification, showPush } from './sw/handlers'
import type { WorkerScope } from './sw/handlers'

// The app's tsconfig is a DOM one, not a webworker one (the two libs conflict) - so the worker's
// global is described by hand: what handlers.ts needs, plus the event and precache hooks used here.
interface WaitableEvent {
  waitUntil: (promise: Promise<unknown>) => void
}

declare const self: WorkerScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
  skipWaiting: () => Promise<void>
  addEventListener(
    type: 'push',
    listener: (event: WaitableEvent & { data: { json: () => unknown } | null }) => void
  ): void
  addEventListener(
    type: 'notificationclick',
    listener: (event: WaitableEvent & { notification: Notification }) => void
  ): void
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every client-side route serves the precached shell, offline included - except the API and the
// health check, which must always reach the server.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/health/] }))

registerRoute(
  ({ url }) =>
    ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com'].includes(url.hostname),
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
)

// registerType: 'autoUpdate' - a new worker takes over at once instead of waiting for every tab to close.
self.skipWaiting()
clientsClaim()

self.addEventListener('push', (event) => event.waitUntil(showPush(self, event.data)))
self.addEventListener('notificationclick', (event) => event.waitUntil(openNotification(self, event.notification)))
