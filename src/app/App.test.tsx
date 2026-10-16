import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { App } from './App'
import { AuthProvider } from '../auth/AuthProvider'

const me = { subject: 'manager', role: 'MEMBER', readableCollectionIds: [], manageableCollectionIds: [] }

function renderApp(fetchImpl = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider fetchImpl={fetchImpl}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('redirects unauthenticated users to the login page', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Welcome to EKA' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
  })

  it('renders primary navigation and default route after sign-in', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(me), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    const { container } = renderApp(fetchImpl)
    await userEvent.type(screen.getByLabelText('Username'), 'manager')
    await userEvent.type(screen.getByLabelText('Password'), 'local-only')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in locally' }))
    expect(await screen.findByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ask your knowledge' })).toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)
  })
})
