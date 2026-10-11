import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './client'
import { toUiError } from './errors'

const err = (status: number, code: string) =>
  new ApiRequestError(status, {
    code,
    message: 'server text with <script>secret</script>',
    correlationId: 'corr-1',
  })

describe('toUiError', () => {
  it.each([
    [400, 'VALIDATION_FAILED', 'validation'],
    [401, 'UNAUTHENTICATED', 'unauthenticated'],
    [403, 'FORBIDDEN', 'forbidden'],
    [404, 'NOT_FOUND', 'not_found'],
    [409, 'DUPLICATE_DOCUMENT', 'duplicate'],
    [413, 'FILE_TOO_LARGE', 'file_too_large'],
    [415, 'UNSUPPORTED_TYPE', 'unsupported_type'],
    [422, 'UNPROCESSABLE_DOCUMENT', 'unprocessable'],
    [503, 'UNKNOWN', 'provider'],
    [500, 'INTERNAL_ERROR', 'service'],
    [0, 'NETWORK_ERROR', 'network'],
  ])('maps %i %s to %s', (status, code, kind) => {
    expect(toUiError(err(status, code)).kind).toBe(kind)
  })

  it('never exposes server message text and keeps the correlation id', () => {
    const ui = toUiError(err(500, 'INTERNAL_ERROR'))
    expect(ui.message).not.toContain('secret')
    expect(ui.correlationId).toBe('corr-1')
  })

  it('treats unknown throwables as a generic service error', () => {
    expect(toUiError(new Error('boom')).kind).toBe('service')
  })
})
