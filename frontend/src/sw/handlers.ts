// The service worker's push behaviour, kept apart from src/sw.ts so it can run under test: the
// worker's `self` is passed in rather than read globally, typed by just the parts used here.

export interface PushPayload {
  title: string
  body: string
  url: string
  tag: string
}

export interface WindowLike {
  url: string
  focus: () => Promise<unknown>
  navigate: (url: string) => Promise<unknown>
}

export interface WorkerScope {
  location: { origin: string }
  registration: {
    showNotification: (title: string, options: NotificationOptions) => Promise<void>
  }
  clients: {
    matchAll: (options: { type: 'window'; includeUncontrolled: boolean }) => Promise<readonly WindowLike[]>
    openWindow: (url: string) => Promise<unknown>
  }
}

const FALLBACK: PushPayload = { title: 'acta', body: '', url: '/', tag: 'acta' }

export function parsePayload(data: { json: () => unknown } | null): PushPayload {
  let parsed: unknown = null
  try {
    // Stryker disable next-line OptionalChaining: without it a null `data` throws here, is caught below, and falls back the same way
    parsed = data?.json() ?? null
  } catch {
    // A push that isn't JSON still has to show *something* - a push with no notification makes
    // browsers show their own generic "site updated in the background" one instead.
  }
  return { ...FALLBACK, ...(typeof parsed === 'object' ? parsed : null) }
}

export function showPush(scope: WorkerScope, data: { json: () => unknown } | null): Promise<void> {
  const payload = parsePayload(data)
  return scope.registration.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    data: { url: payload.url },
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  })
}

/** Opens the page a notification points at - in an acta window that's already open when there
 * is one, so tapping a reminder doesn't stack up tabs. */
export async function openNotification(
  scope: WorkerScope,
  notification: { data?: { url?: string }; close: () => void }
): Promise<unknown> {
  notification.close()
  // Stryker disable next-line StringLiteral: an empty URL resolves to the origin's root, the same as "/"
  const target = new URL(notification.data?.url ?? '/', scope.location.origin)
  // Only ever a page of acta's own: a notification pointing anywhere else opens the start page.
  const url = target.origin === scope.location.origin ? target.href : `${scope.location.origin}/`
  const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const existing = windows.find((each) => new URL(each.url).origin === scope.location.origin)
  if (!existing) return scope.clients.openWindow(url)
  await existing.navigate(url)
  return existing.focus()
}
