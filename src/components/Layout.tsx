import { useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const ROLE_LABEL = {
  ADMIN: 'Administrator',
  MEMBER: 'Member',
  NONE: 'No role assigned',
} as const

const baseNav =
  'rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? baseNav + ' bg-indigo-50 text-indigo-700'
    : baseNav + ' text-slate-700 hover:bg-slate-100'
}

function PrimaryNavigation({
  onNavigate,
  ariaLabel = 'Primary',
}: {
  onNavigate?: () => void
  ariaLabel?: string
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-col gap-1">
      <NavLink to="/assistant" onClick={onNavigate} className={navClass}>
        Ask
      </NavLink>
      <NavLink to="/documents" onClick={onNavigate} className={navClass}>
        Documents
      </NavLink>
    </nav>
  )
}

export function Layout() {
  const { state, signOut } = useAuth()
  const { pathname } = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (state.status !== 'authenticated') return <Navigate to="/login" replace />

  const pageTitle = pathname === '/documents' ? 'Documents' : 'Ask'
  const role = ROLE_LABEL[state.me.role]

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <div className="border-b border-slate-200 bg-slate-50 md:hidden">
        <div className="flex h-[72px] items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white"
            >
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 2 10 5-10 5L2 7z" />
                <path d="m2 12 10 5 10-5" />
                <path d="m2 17 10 5 10-5" />
              </svg>
            </span>
            <span className="text-lg font-bold text-slate-900">eka</span>
          </div>
          <button
            type="button"
            aria-label={
              mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex size-10 items-center justify-center rounded-md text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {mobileMenuOpen ? (
                <path d="m6 6 12 12M18 6 6 18" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between px-5 pb-3 text-sm">
          <span className="font-medium text-indigo-700">{pageTitle}</span>
          <span className="text-xs text-slate-500">{role}</span>
        </div>
        <div
          id="mobile-navigation"
          hidden={!mobileMenuOpen}
          className="border-t border-slate-200 p-4"
        >
          <PrimaryNavigation
            ariaLabel="Mobile primary"
            onNavigate={() => setMobileMenuOpen(false)}
          />
          <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
            <p className="font-semibold text-slate-900">
              Signed in as {state.me.subject}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-1 text-slate-600 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
      <aside className="hidden shrink-0 flex-col gap-6 border-b border-slate-200 bg-slate-50 p-4 md:flex md:w-[208px] md:border-b-0 md:border-r">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 2 10 5-10 5L2 7z" />
              <path d="m2 12 10 5 10-5" />
              <path d="m2 17 10 5 10-5" />
            </svg>
          </span>
          <span className="text-lg font-bold text-slate-900">eka</span>
        </div>
        <PrimaryNavigation />
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="text-xs text-slate-600">Role</p>
          <p className="font-semibold text-slate-900">{role}</p>
        </div>
        <div className="mt-auto flex flex-col gap-1 border-t border-slate-200 pt-4 text-sm">
          <span className="font-semibold text-slate-900">
            Signed in as {state.me.subject}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="self-start text-slate-600 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-16 items-center justify-between border-b border-slate-200 px-8 md:flex">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>eka</span>
            <span aria-hidden="true">›</span>
            <span className="font-medium text-slate-900">{pageTitle}</span>
          </div>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="10" width="16" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
            Access-controlled content
          </span>
        </header>
        <main className="min-w-0 flex-1 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
