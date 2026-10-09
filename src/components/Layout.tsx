import { NavLink, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <>
      <header>
        <nav aria-label="Primary">
          <NavLink to="/assistant">Assistant</NavLink>
          <NavLink to="/documents">Documents</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
