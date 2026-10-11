import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { App } from './App'
import { AuthProvider } from '../auth/AuthProvider'

describe('App shell', () => {
  it('renders primary navigation and default route', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider fetchImpl={vi.fn()}>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('navigation', { name: 'Primary' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Assistant' }),
    ).toBeInTheDocument()
    expect((await axe(container)).violations).toHaveLength(0)
  })
})
