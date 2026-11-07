import { fireEvent, render, screen } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { MemoryRouter } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import { createApiClient } from '../api/client'
import { AppRoutes } from '../app/AppRoutes'
import { RouteErrorBoundary } from '../components/RouteErrorBoundary'
import { RecoverableErrorPage } from './ErrorPages'

const authValue: AuthContextValue = {
  state: {
    status: 'authenticated',
    me: {
      subject: 'user-1',
      role: 'MEMBER',
      readableCollectionIds: [],
      manageableCollectionIds: [],
    },
  },
  api: createApiClient({ fetchImpl: vi.fn() as typeof fetch }),
  signInWithAuthHeader: vi.fn(),
  signInWithBasic: vi.fn(),
  oidcEnabled: false,
  signInWithOidc: vi.fn(),
  completeOidcSignIn: vi.fn(),
  signOut: vi.fn(),
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authValue}>
        <AppRoutes />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('application error pages', () => {
  it('renders a safe access-denied page and returns to Ask', async () => {
    const { container } = renderRoute('/access-denied')

    expect(
      await screen.findByRole('heading', { name: "You don't have access" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/No restricted document names, source text/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Acme workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Knowledge Seeker')).not.toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)

    fireEvent.click(screen.getByRole('link', { name: 'Return to Ask' }))
    expect(
      await screen.findByRole('heading', { name: 'Ask your knowledge' }),
    ).toBeInTheDocument()
  })

  it('renders the not-found page for unknown signed-in routes', async () => {
    const { container } = renderRoute('/not-a-route')

    expect(
      await screen.findByRole('heading', { name: "This page isn't here" }),
    ).toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)
    fireEvent.click(screen.getByRole('link', { name: 'Return to Ask' }))
    expect(
      await screen.findByRole('heading', { name: 'Ask your knowledge' }),
    ).toBeInTheDocument()
  })

  it('catches render failures, hides exception details, and retries rendering', async () => {
    const renderFailure = vi.fn<() => void>(() => {
      throw new Error('private backend detail')
    })
    function FlakyRoute() {
      renderFailure()
      return <p>Recovered route</p>
    }

    const { container } = render(
      <MemoryRouter>
        <RouteErrorBoundary>
          <FlakyRoute />
        </RouteErrorBoundary>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', {
        name: "We couldn't complete that request",
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('private backend detail')).not.toBeInTheDocument()
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)

    renderFailure.mockImplementation(() => undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Recovered route')).toBeInTheDocument()
  })

  it('renders only genuine, well-formed support references', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <MemoryRouter>
        <RecoverableErrorPage onRetry={onRetry} reference="EKA-7F3A2C" />
      </MemoryRouter>,
    )

    expect(screen.getByText('Reference:')).toBeInTheDocument()
    expect(screen.getByText('EKA-7F3A2C')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()

    rerender(
      <MemoryRouter>
        <RecoverableErrorPage
          onRetry={onRetry}
          reference="private document name"
        />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument()
    expect(screen.queryByText('private document name')).not.toBeInTheDocument()
  })
})
