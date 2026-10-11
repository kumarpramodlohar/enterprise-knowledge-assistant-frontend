import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { EmptyState, ErrorState, LoadingState } from './StateViews'

describe('state views', () => {
  it('renders accessible loading and empty states', async () => {
    const { container } = render(
      <>
        <LoadingState />
        <EmptyState title="No documents">Upload one to start.</EmptyState>
      </>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(
      screen.getByRole('heading', { name: 'No documents' }),
    ).toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)
  })

  it('offers retry only for transient errors and shows the reference id', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <ErrorState
        error={{ kind: 'network', message: 'offline', correlationId: 'abc' }}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Reference: abc')
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()

    rerender(
      <ErrorState
        error={{ kind: 'forbidden', message: 'no' }}
        onRetry={onRetry}
      />,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
