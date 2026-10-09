import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { App } from './App'

describe('App shell', () => {
  it('renders primary navigation and default route', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
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
