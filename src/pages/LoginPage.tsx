import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toUiError, type UiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'

const inputClass =
  'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 aria-[invalid=true]:border-red-700'

export function LoginPage() {
  const { state, signInWithBasic } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordMissing, setPasswordMissing] = useState(false)
  const [error, setError] = useState<UiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (state.status === 'authenticated') return <Navigate to="/assistant" replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password === '') {
      setPasswordMissing(true)
      return
    }
    setPasswordMissing(false)
    setSubmitting(true)
    try {
      await signInWithBasic(username, password)
      setPassword('')
      navigate('/assistant', { replace: true })
    } catch (cause) {
      const uiError = toUiError(cause)
      setError(
        uiError.kind === 'unauthenticated'
          ? { ...uiError, message: 'Sign-in failed. Check your username and password.' }
          : uiError,
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <aside className="flex flex-col gap-10 bg-[#20233d] p-8 text-white lg:w-[480px] lg:shrink-0 lg:gap-16 lg:p-12">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 2 10 5-10 5L2 7z" />
              <path d="m2 12 10 5 10-5" />
              <path d="m2 17 10 5 10-5" />
            </svg>
          </span>
          <span className="text-[19px] font-bold">eka</span>
        </div>
        <div className="flex flex-col gap-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#aeb4dc]">
            Enterprise Knowledge Assistant
          </p>
          <p className="text-4xl font-semibold leading-tight lg:text-[40px]">
            Your knowledge.
            <br />
            Clear answers.
          </p>
          <p className="leading-relaxed text-[#c6cadd]">
            Find grounded answers in your team’s technical documents, with sources you can verify.
          </p>
        </div>
        <div className="hidden flex-col gap-5 rounded-xl border border-white/15 bg-white/5 p-6 lg:flex" aria-hidden="true">
          <span className="text-[13px] font-medium text-[#e4e5f3]">Technical documentation</span>
          <span className="h-[7px] w-[270px] max-w-full rounded-[3px] bg-white/15" />
          <span className="h-[7px] w-[300px] max-w-full rounded-[3px] bg-[#8e89f5]" />
          <span className="h-[7px] w-[210px] max-w-full rounded-[3px] bg-white/15" />
          <span className="self-start rounded-[5px] bg-white/5 px-2.5 py-1.5 text-[11px] text-[#d8daf6]">
            Answers with source citations
          </span>
        </div>
        <p className="text-xs leading-relaxed text-[#b9bedf]">
          Only knowledge you’re authorized to access.
          <br />
          Original files are never stored; only extracted text and metadata are retained.
        </p>
      </aside>

      <main className="flex-1 px-6 py-10 lg:px-[152px] lg:pt-[72px]">
        <div className="mx-auto flex max-w-[520px] flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Sign in
            </p>
            <h1 className="text-[28px] font-bold leading-10 text-slate-900">Welcome to EKA</h1>
            <p className="text-slate-600">Sign in to continue to Enterprise Knowledge Assistant.</p>
          </div>

          {/* The OIDC redirect flow is not implemented in the frontend yet, so this stays disabled. */}
          <button
            type="button"
            disabled
            className="h-[46px] w-full rounded-md bg-indigo-600 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with company SSO
          </button>
          <p className="text-sm text-slate-600">SSO sign-in is not available yet in this build.</p>

          <div className="flex items-center gap-3 text-[11px] text-slate-600" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            OR
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submit} aria-label="Local development sign-in" noValidate className="flex flex-col gap-[18px]">
            <div className="flex flex-col gap-1.5 text-sm">
              <h2 className="font-semibold text-slate-900">Local development sign-in</h2>
              <p className="text-slate-600">For local development environments only.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-username" className="text-[13px] font-semibold text-slate-900">
                Username
              </label>
              <input
                id="login-username"
                className={inputClass}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-[13px] font-semibold text-slate-900">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                className={inputClass}
                placeholder="Enter password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={passwordMissing}
                aria-describedby={passwordMissing ? 'login-password-error' : undefined}
              />
              {passwordMissing && (
                <p id="login-password-error" className="text-xs text-red-700">
                  Enter your password to continue.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error.message}
                {error.correlationId && ` (Reference: ${error.correlationId})`}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="h-[46px] w-full rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in locally'}
            </button>
          </form>

          <hr className="border-slate-200" />
          <p className="text-sm leading-relaxed text-slate-600">
            Your role and collection permissions determine what you can access.
          </p>
          <p className="text-xs text-slate-600">Need access? Contact your administrator.</p>
        </div>
      </main>
    </div>
  )
}
