import { describe, expect, it, vi } from 'vitest'

import { openNotification, parsePayload, showPush } from '../../src/sw/handlers'
import type { WindowLike, WorkerScope } from '../../src/sw/handlers'

function makeScope(windows: WindowLike[] = []) {
  return {
    location: { origin: 'https://acta.example' },
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow: vi.fn().mockResolvedValue('opened'),
    },
  } satisfies WorkerScope
}

function makeWindow(url: string): WindowLike {
  return { url, focus: vi.fn().mockResolvedValue('focused'), navigate: vi.fn().mockResolvedValue(undefined) }
}

const json = (value: unknown) => ({ json: () => value })

describe('parsePayload', () => {
  it('reads every field from the push', () => {
    expect(
      parsePayload(json({ title: 'Pay rent', body: 'Due now · Home', url: '/boards/b1?card=c1', tag: 'card-c1' }))
    ).toEqual({
      title: 'Pay rent',
      body: 'Due now · Home',
      url: '/boards/b1?card=c1',
      tag: 'card-c1',
    })
  })

  it('fills in whatever the push left out', () => {
    expect(parsePayload(json({ title: 'Only a title' }))).toEqual({
      title: 'Only a title',
      body: '',
      url: '/',
      tag: 'acta',
    })
  })

  it.each([
    ['no data', null],
    ['a null body', json(null)],
    ['a non-object body', json('text')],
    [
      'a body that is not JSON',
      {
        json: () => {
          throw new SyntaxError('bad')
        },
      },
    ],
  ])('falls back to a plain acta notification for %s', (_, data) => {
    expect(parsePayload(data)).toEqual({ title: 'acta', body: '', url: '/', tag: 'acta' })
  })
})

describe('showPush', () => {
  it('shows the notification with its body, tag and target url', async () => {
    const scope = makeScope()
    await showPush(scope, json({ title: 'Pay rent', body: 'Due now', url: '/boards/b1', tag: 'card-c1' }))
    expect(scope.registration.showNotification).toHaveBeenCalledWith('Pay rent', {
      body: 'Due now',
      tag: 'card-c1',
      data: { url: '/boards/b1' },
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
    })
  })
})

describe('openNotification', () => {
  it('closes the notification and opens a new window when none is open', async () => {
    const scope = makeScope()
    const close = vi.fn()
    await expect(openNotification(scope, { data: { url: '/boards/b1?card=c1' }, close })).resolves.toBe('opened')
    expect(close).toHaveBeenCalled()
    expect(scope.clients.matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true })
    expect(scope.clients.openWindow).toHaveBeenCalledWith('https://acta.example/boards/b1?card=c1')
  })

  it('reuses an acta window that is already open', async () => {
    const other = makeWindow('https://elsewhere.example/')
    const acta = makeWindow('https://acta.example/settings')
    const scope = makeScope([other, acta])
    await expect(openNotification(scope, { data: { url: '/boards/b1' }, close: vi.fn() })).resolves.toBe('focused')
    expect(acta.navigate).toHaveBeenCalledWith('https://acta.example/boards/b1')
    expect(other.navigate).not.toHaveBeenCalled()
    expect(scope.clients.openWindow).not.toHaveBeenCalled()
  })

  it('goes to the start page when the notification carries no url', async () => {
    const scope = makeScope()
    await openNotification(scope, { close: vi.fn() })
    expect(scope.clients.openWindow).toHaveBeenCalledWith('https://acta.example/')
    await openNotification(scope, { data: {}, close: vi.fn() })
    expect(scope.clients.openWindow).toHaveBeenLastCalledWith('https://acta.example/')
  })
})
