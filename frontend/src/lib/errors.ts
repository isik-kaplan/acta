import { ApiError, NetworkError } from '../api/client'

export const GENERIC_ERROR = 'Something went wrong. Try again.'

/** The message worth showing for a failed action: the server's own words or the "can't connect"
 * line, and a generic one for anything else - a stack-trace-y TypeError is no use to read. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError || error instanceof NetworkError ? error.message : GENERIC_ERROR
}
