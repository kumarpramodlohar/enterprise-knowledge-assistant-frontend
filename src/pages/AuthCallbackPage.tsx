import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** Finishes the OIDC redirect. Failure details from the provider or server are never rendered. */
export function AuthCallbackPage() {
  const { completeOidcSignIn } = useAuth()
  const navigate = useNavigate()
  const started = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // The authorization code can be redeemed once, so guard against a repeated effect run.
    if (started.current) return
    started.current = true
    completeOidcSignIn().then(
      () => navigate('/assistant', { replace: true }),
      () => setFailed(true),
    )
  }, [completeOidcSignIn, navigate])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      {failed ? (
        <>
          <h1 className="text-xl font-semibold text-slate-900">Sign-in could not be completed</h1>
          <p role="alert" className="text-slate-600">
            Try again. If the problem continues, contact your administrator.
          </p>
          <Link to="/login" replace className="font-medium text-indigo-700 underline">
            Back to sign in
          </Link>
        </>
      ) : (
        <p role="status" className="text-slate-600">Completing sign-in…</p>
      )}
    </main>
  )
}
