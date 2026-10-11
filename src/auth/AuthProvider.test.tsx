import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './AuthContext'

const me = { subject: 'dev', role: 'MEMBER', readableCollectionIds: [] }

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup(fetchImpl: typeof fetch) {
  let ctx!: ReturnType<typeof useAuth>
  function Probe() {
    ctx = useAuth()
    return <p>{ctx.state.status}</p>
  }
  render(
    <AuthProvider fetchImpl={fetchImpl} baseUrl="http://api">
      <Probe />
    </AuthProvider>,
  )
  return () => ctx
}

describe('AuthProvider', () => {
  it('sends no credentials until signed in, then attaches them', async () => {
    const fetchImpl = vi.fn(async () =>
      respond(200, me),
    ) as unknown as typeof fetch
    const get = setup(fetchImpl)
    await act(() => get().api.me())
    expect(
      new Headers(vi.mocked(fetchImpl).mock.calls[0][1]?.headers).get(
        'Authorization',
      ),
    ).toBeNull()

    await act(() => get().signInWithBasic('dev', 'pw'))
    expect(screen.getByText('authenticated')).toBeInTheDocument()
    const last = vi.mocked(fetchImpl).mock.calls.at(-1)!
    expect(new Headers(last[1]?.headers).get('Authorization')).toBe(
      `Basic ${btoa('dev:pw')}`,
    )
  })

  it('stays anonymous and rethrows when sign-in is rejected', async () => {
    const fetchImpl = vi.fn(async () =>
      respond(401, {
        code: 'UNAUTHENTICATED',
        message: 'x',
        correlationId: 'c',
      }),
    ) as unknown as typeof fetch
    const get = setup(fetchImpl)
    await expect(
      act(() => get().signInWithBasic('dev', 'bad')),
    ).rejects.toThrow()
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })

  it('marks the session expired when a later request returns 401', async () => {
    let status = 200
    const fetchImpl = vi.fn(async () =>
      status === 200
        ? respond(200, me)
        : respond(401, {
            code: 'UNAUTHENTICATED',
            message: 'x',
            correlationId: 'c',
          }),
    ) as unknown as typeof fetch
    const get = setup(fetchImpl)
    await act(() => get().signInWithBasic('dev', 'pw'))
    status = 401
    await act(() =>
      get()
        .api.listDocuments()
        .catch(() => undefined),
    )
    await waitFor(() => expect(screen.getByText('expired')).toBeInTheDocument())
    status = 200
    await act(() => get().api.me())
    expect(
      new Headers(vi.mocked(fetchImpl).mock.calls.at(-1)![1]?.headers).get(
        'Authorization',
      ),
    ).toBeNull()
  })

  it('does not persist credentials in web storage and signOut clears them', async () => {
    const fetchImpl = vi.fn(async () =>
      respond(200, me),
    ) as unknown as typeof fetch
    const get = setup(fetchImpl)
    await act(() => get().signInWithBasic('dev', 'pw'))
    expect(JSON.stringify({ ...localStorage })).not.toContain('pw')
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('pw')
    act(() => get().signOut())
    expect(screen.getByText('anonymous')).toBeInTheDocument()
  })
})
