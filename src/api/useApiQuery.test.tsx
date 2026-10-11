import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './client'
import { useApiQuery } from './useApiQuery'

describe('useApiQuery', () => {
  it('goes from loading to success', async () => {
    const load = () => Promise.resolve(42)
    const { result } = renderHook(() => useApiQuery(load))
    expect(result.current.state.status).toBe('loading')
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'success', data: 42 }),
    )
  })

  it('maps failures to a safe UI error and retries', async () => {
    let calls = 0
    const load = () =>
      ++calls === 1
        ? Promise.reject(
            new ApiRequestError(503, {
              code: 'X',
              message: 'm',
              correlationId: 'c',
            }),
          )
        : Promise.resolve('ok')
    const { result } = renderHook(() => useApiQuery(load))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.state).toMatchObject({ error: { kind: 'provider' } })
    result.current.retry()
    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'success', data: 'ok' }),
    )
  })
})
