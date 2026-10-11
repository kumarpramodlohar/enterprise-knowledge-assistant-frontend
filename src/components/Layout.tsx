import { NavLink, Outlet } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { toUiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from './StateViews'

export function Layout() {
  const { state, signInWithBasic, signOut } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ReturnType<typeof toUiError> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signInWithBasic(username, password)
      setPassword('')
    } catch (cause) {
      setError(toUiError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <header>
        <nav aria-label="Primary">
          <NavLink to="/assistant">Assistant</NavLink>
          <NavLink to="/documents">Documents</NavLink>
        </nav>
        {state.status === 'authenticated' ? (
          <div>
            <span>Signed in as {state.me.subject}</span>
            <button type="button" onClick={signOut}>Sign out</button>
          </div>
        ) : (
          <form onSubmit={signIn} aria-label="Sign in">
            <label>
              Username
              <input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Password
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in (local)'}</button>
            {error && <ErrorState error={error} />}
          </form>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  )
}
