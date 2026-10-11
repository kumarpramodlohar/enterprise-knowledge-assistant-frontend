import type { ReactNode } from 'react'
import type { UiError } from '../api/errors'

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite">
      {label}
    </p>
  )
}

export function EmptyState({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

/** Renders a mapped error; only fixed text and the correlation id are shown. */
export function ErrorState({
  error,
  onRetry,
}: {
  error: UiError
  onRetry?: () => void
}) {
  const retryable = ['network', 'provider', 'service'].includes(error.kind)
  return (
    <div role="alert" data-kind={error.kind}>
      <p>{error.message}</p>
      {error.correlationId && <p>Reference: {error.correlationId}</p>}
      {retryable && onRetry && (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
