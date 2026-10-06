import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '../../src/api/client'
import * as endpoints from '../../src/api/endpoints'

vi.mock('../../src/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

const FIELDS = { title: 'Water plants', notes: '', due_at: null }
const SUBSCRIPTION = { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }

beforeEach(() => {
  for (const method of Object.values(api)) {
    vi.mocked(method).mockReset().mockResolvedValue('result')
  }
})

describe('endpoints', () => {
  it.each([
    ['fetchCurrentUser', () => endpoints.fetchCurrentUser(), 'get', ['/auth/me']],
    ['login', () => endpoints.login('a@b.c', 'pw'), 'post', ['/auth/login', { email: 'a@b.c', password: 'pw' }]],
    [
      'register',
      () => endpoints.register('a@b.c', 'pw', 'Ada'),
      'post',
      ['/auth/register', { email: 'a@b.c', password: 'pw', display_name: 'Ada' }],
    ],
    ['logout', () => endpoints.logout(), 'post', ['/auth/logout']],
    [
      'changePassword',
      () => endpoints.changePassword('old', 'new'),
      'post',
      ['/account/password', { current_password: 'old', new_password: 'new' }],
    ],
    ['fetchBoards', () => endpoints.fetchBoards(), 'get', ['/boards']],
    ['fetchBoard', () => endpoints.fetchBoard('b1'), 'get', ['/boards/b1']],
    ['createBoard', () => endpoints.createBoard('Home'), 'post', ['/boards', { name: 'Home' }]],
    ['renameBoard', () => endpoints.renameBoard('b1', 'Work'), 'patch', ['/boards/b1', { name: 'Work' }]],
    ['deleteBoard', () => endpoints.deleteBoard('b1'), 'delete', ['/boards/b1']],
    ['createColumn', () => endpoints.createColumn('b1', 'Later'), 'post', ['/boards/b1/columns', { name: 'Later' }]],
    ['renameColumn', () => endpoints.renameColumn('c1', 'Now'), 'patch', ['/columns/c1', { name: 'Now' }]],
    ['moveColumn', () => endpoints.moveColumn('c1', 2), 'post', ['/columns/c1/move', { index: 2 }]],
    ['deleteColumn', () => endpoints.deleteColumn('c1'), 'delete', ['/columns/c1']],
    ['createCard', () => endpoints.createCard('c1', FIELDS), 'post', ['/columns/c1/cards', FIELDS]],
    ['updateCard', () => endpoints.updateCard('k1', FIELDS), 'put', ['/cards/k1', FIELDS]],
    ['moveCard', () => endpoints.moveCard('k1', 'c2', 3), 'post', ['/cards/k1/move', { column_id: 'c2', index: 3 }]],
    ['deleteCard', () => endpoints.deleteCard('k1'), 'delete', ['/cards/k1']],
    ['fetchPushKey', () => endpoints.fetchPushKey(), 'get', ['/push/public-key']],
    [
      'savePushSubscription',
      () => endpoints.savePushSubscription(SUBSCRIPTION),
      'post',
      ['/push/subscriptions', SUBSCRIPTION],
    ],
    [
      'removePushSubscription',
      () => endpoints.removePushSubscription('https://push.example/1'),
      'post',
      ['/push/unsubscribe', { endpoint: 'https://push.example/1' }],
    ],
    ['sendTestPush', () => endpoints.sendTestPush(), 'post', ['/push/test']],
  ] as const)('%s', async (_, call, method, args) => {
    await expect(call()).resolves.toBe('result')
    expect(api[method]).toHaveBeenCalledWith(...args)
    expect(api[method]).toHaveBeenCalledTimes(1)
  })
})
