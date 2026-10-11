import { useCallback, useEffect, useState } from 'react'
import { toUiError, type UiError } from './errors'

export type QueryState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: UiError }

type Settled<T> = { key: object } & (
  { status: 'success'; data: T } | { status: 'error'; error: UiError }
)

/** Runs `load` on mount/when it changes and exposes loading, success and mapped-error states. */
export function useApiQuery<T>(load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  // A result only counts for the request that produced it; anything else is loading.
  const key = { load, attempt }

  useEffect(() => {
    let cancelled = false
    const current = { load, attempt }
    load().then(
      (data) =>
        !cancelled && setSettled({ key: current, status: 'success', data }),
      (error) =>
        !cancelled &&
        setSettled({ key: current, status: 'error', error: toUiError(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [load, attempt])

  const k = settled?.key as { load: unknown; attempt: number } | undefined
  const fresh = k && k.load === key.load && k.attempt === key.attempt
  const state: QueryState<T> =
    settled && fresh
      ? settled.status === 'success'
        ? { status: 'success', data: settled.data }
        : { status: 'error', error: settled.error }
      : { status: 'loading' }

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, retry }
}
