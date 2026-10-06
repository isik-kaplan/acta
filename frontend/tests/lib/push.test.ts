import { fc, test } from '@fast-check/vitest'
import { describe, expect, it } from 'vitest'

import { decodeServerKey } from '../../src/lib/push'

function toBase64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

describe('decodeServerKey', () => {
  it('decodes the url-safe alphabet', () => {
    expect([...decodeServerKey('-_8')]).toEqual([251, 255])
  })

  test.prop([fc.uint8Array({ maxLength: 70 })])('round-trips any bytes from unpadded base64url', (bytes) => {
    const decoded = decodeServerKey(toBase64Url(bytes))
    expect(decoded).toBeInstanceOf(Uint8Array)
    expect([...decoded]).toEqual([...bytes])
  })
})
