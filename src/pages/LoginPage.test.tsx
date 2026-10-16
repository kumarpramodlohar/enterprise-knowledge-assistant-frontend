import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { App } from '../app/App'
import { AuthProvider } from '../auth/AuthProvider'

function renderLogin(fetchImpl = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider fetchImpl={fetchImpl}>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  it('renders the sign-in form accessibly', async () => {
    const { container } = renderLogin()
    expect(screen.getByRole('heading', { name: 'Welcome to EKA' })).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)
  })

  it('requires a password before calling the server', async () => {
    const fetchImpl = vi.fn()
    renderLogin(fetchImpl)
    await userEvent.type(screen.getByLabelText('Username'), 'dev')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in locally' }))
    expect(screen.getByText('Enter your password to continue.')).toBeInTheDocument()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('shows a safe error when sign-in fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }))
    renderLogin(fetchImpl)
    await userEvent.type(screen.getByLabelText('Username'), 'dev')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in locally' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Check your username and password')
  })
})
