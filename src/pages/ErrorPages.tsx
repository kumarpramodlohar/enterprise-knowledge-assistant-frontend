import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const primaryActionClass =
  'inline-flex min-h-9 items-center justify-center rounded-md bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2'

const secondaryActionClass =
  'inline-flex min-h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2'

function PrivacyNote() {
  return (
    <aside className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-left">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
        <img
          src="/assets/error-states/privacy-lock.svg"
          alt=""
          width="16"
          height="16"
        />
        <span>Your content stays private</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        No restricted document names, source text, or collection details are
        shown here.
      </p>
    </aside>
  )
}

function ErrorPageLayout({
  code,
  icon,
  title,
  children,
  actions,
  note,
}: {
  code: string
  icon: string
  title: string
  children: ReactNode
  actions: ReactNode
  note?: ReactNode
}) {
  return (
    <section
      aria-labelledby="error-page-heading"
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 py-10 sm:px-8"
    >
      <div className="w-full max-w-[400px] text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo-50">
          <img src={icon} alt="" width="32" height="32" />
        </div>
        <p
          className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500"
          role="status"
        >
          {code}
        </p>
        <h1
          className="mt-4 text-[28px] font-bold leading-10 text-slate-900"
          id="error-page-heading"
        >
          {title}
        </h1>
        <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actions}
        </div>
        {note}
      </div>
    </section>
  )
}

export function AccessDeniedPage() {
  return (
    <ErrorPageLayout
      code="403 · Access denied"
      icon="/assets/error-states/access-denied.svg"
      title="You don't have access"
      actions={
        <Link className={primaryActionClass} to="/assistant">
          Return to Ask
        </Link>
      }
      note={<PrivacyNote />}
    >
      Your current role doesn't allow this action. Return to a permitted page
      or contact your administrator if you need help.
    </ErrorPageLayout>
  )
}

export function NotFoundPage() {
  return (
    <ErrorPageLayout
      code="404 · Not found"
      icon="/assets/error-states/page-not-found.svg"
      title="This page isn't here"
      actions={
        <Link className={primaryActionClass} to="/assistant">
          Return to Ask
        </Link>
      }
      note={<PrivacyNote />}
    >
      The link may have changed or the page may no longer be available. Return
      to Ask to continue.
    </ErrorPageLayout>
  )
}

function isSafeReference(reference: string | undefined): reference is string {
  return (
    reference !== undefined &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(reference)
  )
}

export function RecoverableErrorPage({
  onRetry,
  reference,
}: {
  onRetry: () => void
  reference?: string
}) {
  return (
    <ErrorPageLayout
      code="Request failed"
      icon="/assets/error-states/recoverable-error.svg"
      title="We couldn't complete that request"
      actions={
        <>
          <button className={primaryActionClass} onClick={onRetry} type="button">
            Try again
          </button>
          <Link className={secondaryActionClass} to="/assistant">
            Back to Ask
          </Link>
        </>
      }
      note={
        <aside className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-left">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <img
              src="/assets/error-states/info.svg"
              alt=""
              width="16"
              height="16"
            />
            <span>Need help with this error?</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {isSafeReference(reference)
              ? 'Share this reference with your support team. It contains no credentials or document content.'
              : 'Contact your support team for help. This message contains no credentials or document content.'}
          </p>
          {isSafeReference(reference) && (
            <p className="mt-3 border-t border-slate-200 pt-3 font-mono text-xs text-slate-500">
              Reference: <span>{reference}</span>
            </p>
          )}
        </aside>
      }
    >
      Something interrupted the request. Try again, or return to Ask. Your
      access permissions have not changed.
    </ErrorPageLayout>
  )
}
