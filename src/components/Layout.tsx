import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const ROLE_LABEL = { ADMIN: 'Administrator', MEMBER: 'Member', NONE: 'No role assigned' } as const

const baseNav =
  'rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? baseNav + ' bg-indigo-50 text-indigo-700'
    : baseNav + ' text-slate-700 hover:bg-slate-100'
}

export function Layout() {
  const { state, signOut } = useAuth()

  if (state.status !== 'authenticated') return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen flex-col bg-white md:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-slate-200 bg-slate-50 p-4 md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 2 10 5-10 5L2 7z" />
              <path d="m2 12 10 5 10-5" />
              <path d="m2 17 10 5 10-5" />
            </svg>
          </span>
          <span className="text-lg font-bold text-slate-900">eka</span>
        </div>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          <NavLink to="/assistant" className={navClass}>Ask</NavLink>
          <NavLink to="/documents" className={navClass}>Documents</NavLink>
        </nav>
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <p className="text-xs text-slate-600">Role</p>
          <p className="font-semibold text-slate-900">{ROLE_LABEL[state.me.role]}</p>
        </div>
        <div className="mt-auto flex flex-col gap-1 border-t border-slate-200 pt-4 text-sm">
          <span className="font-semibold text-slate-900">Signed in as {state.me.subject}</span>
          <button type="button" onClick={signOut} className="self-start text-slate-600 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  )
}
