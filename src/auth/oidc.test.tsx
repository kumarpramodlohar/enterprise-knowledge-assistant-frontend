import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../app/App'
import { AuthProvider } from './AuthProvider'
import type { OidcClient } from './oidcClient'

const me = { subject: 'kc-sub-1', role: 'MEMBER', readableCollectionIds: ['c1'], manageableCollectionIds: [] }

function fakeOidc() {
  let token: string | null = null
  let ended: () => void = () => {}
  const client: OidcClient = {
    startSignIn: vi.fn().mockResolvedValue(undefined),
    completeSignIn: vi.fn(async () => {
      token = 'access-1'
    }),
    authHeader: () => (token ? `Bearer ${token}` : null),
    signOut: vi.fn().mockResolvedValue(undefined),
    onSessionEnded: (listener) => {
      ended = listener
      return () => {}
    },
  }
  return { client, endSession: () => ended(), setToken: (value: string) => (token = value) }
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function renderApp(path: string, oidc: OidcClient, fetchImpl: typeof fetch) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider fetchImpl={fetchImpl} oidc={oidc}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('OIDC sign-in', () => {
  it('starts the provider redirect from the SSO button', async () => {
    const { client } = fakeOidc()
    renderApp('/login', client, vi.fn() as unknown as typeof fetch)
    const button = screen.getByRole('button', { name: 'Continue with company SSO' })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    expect(client.startSignIn).toHaveBeenCalledTimes(1)
  })

  it('keeps the SSO button disabled when OIDC is not configured', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider fetchImpl={vi.fn() as unknown as typeof fetch}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: 'Continue with company SSO' })).toBeDisabled()
  })

  it('completes the callback, sends the bearer token and lands on the Ask page', async () => {
    const { client } = fakeOidc()
    const fetchImpl = vi.fn(async () => jsonResponse(200, me)) as unknown as typeof fetch
    renderApp('/auth/callback?code=abc&state=xyz', client, fetchImpl)
    expect(await screen.findByRole('heading', { name: 'Ask your knowledge' })).toBeInTheDocument()
    expect(client.completeSignIn).toHaveBeenCalledTimes(1)
    const headers = new Headers(vi.mocked(fetchImpl).mock.calls.at(-1)![1]?.headers)
    expect(headers.get('Authorization')).toBe('Bearer access-1')
  })

  it('shows a safe message when the callback fails', async () => {
    const { client } = fakeOidc()
    vi.mocked(client.completeSignIn).mockRejectedValue(new Error('secret provider detail'))
    renderApp('/auth/callback', client, vi.fn() as unknown as typeof fetch)
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again')
    expect(screen.queryByText(/secret provider detail/)).not.toBeInTheDocument()
  })

  it('returns to the login page with an expiry notice when the token cannot be renewed', async () => {
    const { client, endSession } = fakeOidc()
    const fetchImpl = vi.fn(async () => jsonResponse(200, me)) as unknown as typeof fetch
    renderApp('/auth/callback', client, fetchImpl)
    await screen.findByRole('heading', { name: 'Ask your knowledge' })
    act(() => endSession())
    expect(await screen.findByText('Your session has expired. Sign in again.')).toBeInTheDocument()
  })

  it('ends the provider session on sign-out', async () => {
    const { client } = fakeOidc()
    const fetchImpl = vi.fn(async () => jsonResponse(200, me)) as unknown as typeof fetch
    renderApp('/auth/callback', client, fetchImpl)
    await screen.findByRole('heading', { name: 'Ask your knowledge' })
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(client.signOut).toHaveBeenCalledTimes(1))
  })

  it('shows a no-access notice for a user without collection grants', async () => {
    const { client } = fakeOidc()
    const fetchImpl = vi.fn(async () => jsonResponse(200, { ...me, readableCollectionIds: [] })) as unknown as typeof fetch
    renderApp('/auth/callback', client, fetchImpl)
    expect(await screen.findByText(/do not have access to any collections yet/)).toBeInTheDocument()
  })
})
