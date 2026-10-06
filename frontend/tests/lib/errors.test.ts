import { describe, expect, it } from 'vitest'

import { ApiError, NetworkError } from '../../src/api/client'
import { GENERIC_ERROR, errorMessage } from '../../src/lib/errors'

describe('errorMessage', () => {
  it('shows what the server said', () => {
    expect(errorMessage(new ApiError('No board found with this id.', 404))).toBe('No board found with this id.')
  })

  it("shows the can't-connect line", () => {
    expect(errorMessage(new NetworkError())).toBe("Can't connect. Check your connection and try again.")
  })

  it('hides anything else behind a generic line', () => {
    expect(GENERIC_ERROR).toBe('Something went wrong. Try again.')
    expect(errorMessage(new TypeError('x is undefined'))).toBe(GENERIC_ERROR)
    expect(errorMessage('nope')).toBe(GENERIC_ERROR)
  })
})
