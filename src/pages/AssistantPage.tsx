import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ChatQueryResponse, Citation } from '../api/types'
import { ApiRequestError } from '../api/client'
import { toUiError, type UiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/StateViews'

type SourceState = 'checking' | 'available' | 'unavailable' | 'error'

interface SelectedSource {
  citation: Citation
  state: SourceState
  error: UiError | null
}

const fieldClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600'

function citationLabel(citation: Citation, index: number): string {
  const parts = [citation.fileName]
  if (citation.section) parts.push(citation.section)
  if (citation.pageNumber != null) parts.push('p.' + citation.pageNumber)
  return '[' + (index + 1) + '] ' + parts.join(', ')
}

export function AssistantPage() {
  const { api, state } = useAuth()
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [version, setVersion] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [tags, setTags] = useState('')
  const [result, setResult] = useState<ChatQueryResponse | null>(null)
  const [error, setError] = useState<UiError | null>(null)
  const [pending, setPending] = useState(false)
  const [source, setSource] = useState<SelectedSource | null>(null)

  async function ask() {
    if (pending || !question.trim()) return
    setPending(true)
    setError(null)
    setResult(null)
    setSource(null)
    setAsked(question)
    try {
      setResult(await api.queryChat({
        question,
        filters: collectionId || version || documentType || tags
          ? {
              ...(collectionId ? { collectionIds: [collectionId] } : {}),
              ...(version ? { version } : {}),
              ...(documentType ? { documentType } : {}),
              ...(tags ? { tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean) } : {}),
            }
          : undefined,
      }))
    } catch (cause) {
      setError(toUiError(cause))
    } finally {
      setPending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void ask()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void ask()
    }
  }

  async function verifySource(citation: Citation) {
    setSource({ citation, state: 'checking', error: null })
    try {
      const document = await api.getDocument(citation.documentId)
      setSource({ citation, state: document.status === 'INDEXED' ? 'available' : 'unavailable', error: null })
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 404) {
        setSource({ citation, state: 'unavailable', error: null })
      } else {
        setSource({ citation, state: 'error', error: toUiError(cause) })
      }
    }
  }

  const me = state.status === 'authenticated' ? state.me : null
  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-[28px] font-bold text-slate-900">Ask your knowledge</h1>
      <p className="mt-2 text-slate-600">Answers grounded in your permitted technical documents.</p>

      {!me ? (
        <p className="mt-6">Sign in to ask questions about documents you can access.</p>
      ) : me.readableCollectionIds.length === 0 && me.role !== 'ADMIN' ? (
        <p role="status" className="mt-6 rounded-md bg-amber-50 p-4 text-amber-900">
          You do not have access to any collections yet. Contact your administrator.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="collection" className="text-xs font-semibold text-slate-600">
                Search in
              </label>
              <select
                id="collection"
                className={fieldClass + ' h-11'}
                value={collectionId}
                onChange={(event) => setCollectionId(event.target.value)}
              >
                <option value="">All accessible collections</option>
                {me.readableCollectionIds.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <p className="text-sm text-slate-600">Only collections you can access are listed.</p>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-slate-700">More filters</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="version" className="text-xs font-semibold text-slate-600">Version (optional)</label>
                    <input id="version" className={fieldClass + ' h-10'} maxLength={100} value={version} onChange={(event) => setVersion(event.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="document-type" className="text-xs font-semibold text-slate-600">Document type (optional)</label>
                    <input id="document-type" className={fieldClass + ' h-10'} maxLength={100} value={documentType} onChange={(event) => setDocumentType(event.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="tags" className="text-xs font-semibold text-slate-600">Tags (comma-separated, optional)</label>
                    <input id="tags" className={fieldClass + ' h-10'} value={tags} onChange={(event) => setTags(event.target.value)} />
                  </div>
                </div>
              </details>
            </div>

            {asked && (
              <div className="flex gap-3">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700">
                  {me.subject.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-slate-600">You</p>
                  <p className="text-lg font-semibold text-slate-900">{asked}</p>
                </div>
              </div>
            )}

            {error && <ErrorState error={error} />}

            {result && (
              <section aria-live="polite" aria-label="Answer" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">EKA</span>
                  <span className="text-xs text-slate-600">
                    {result.insufficientEvidence ? 'No supporting evidence' : 'Grounded answer'}
                  </span>
                </div>
                {result.insufficientEvidence ? (
                  <h2 className="mt-4 text-base font-semibold text-amber-900">Insufficient evidence</h2>
                ) : (
                  <h2 className="sr-only">Answer</h2>
                )}
                <p className="mt-4 text-lg leading-relaxed text-slate-900">
                  {result.answer ?? "I couldn't find enough evidence in the documents you can access to answer that."}
                </p>
                {result.citations.length > 0 && (
                  <ol aria-label="Sources" className="mt-5 flex flex-col gap-3">
                    {result.citations.map((citation, index) => {
                      const checking = source?.citation.chunkId === citation.chunkId && source.state === 'checking'
                      return (
                        <li key={citation.chunkId} className="rounded-md border border-indigo-300 bg-indigo-50 p-3">
                          <p className="text-sm text-indigo-700">{citationLabel(citation, index)}</p>
                          <button
                            type="button"
                            disabled={checking}
                            onClick={() => void verifySource(citation)}
                            className="mt-1 text-xs font-semibold text-indigo-700 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                          >
                            {checking ? 'Checking access…' : 'Verify and view source'}
                          </button>
                        </li>
                      )
                    })}
                  </ol>
                )}
                <p className="mt-4 text-xs text-slate-600">Request reference: {result.correlationId}</p>
              </section>
            )}

            <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4">
              <label htmlFor="question" className="text-xs font-semibold text-slate-900">Question</label>
              <textarea
                id="question"
                className="mt-2 block w-full resize-none text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
                rows={2}
                placeholder="What would you like to know?"
                value={question}
                maxLength={2000}
                required
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={onKeyDown}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-600">Enter to send · Shift + Enter for a new line</p>
                <button
                  disabled={pending || !question.trim()}
                  className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:bg-slate-200 disabled:text-slate-600"
                >
                  {pending ? 'Searching…' : 'Ask'}
                </button>
              </div>
            </form>
            <p className="text-sm text-slate-600">Access is checked before retrieval, citations and AI calls.</p>
          </div>

          <aside aria-label="Extracted source" className="h-fit rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-[11px] font-semibold uppercase text-slate-600">Extracted source</p>
            {!source && (
              <p className="mt-3 text-sm text-slate-600">Select “Verify and view source” on a citation to see its extracted text here.</p>
            )}
            {source && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="font-semibold text-slate-900">{source.citation.fileName}</p>
                {(source.citation.section || source.citation.pageNumber != null) && (
                  <p className="text-sm text-slate-600">
                    {[source.citation.section, source.citation.pageNumber != null ? 'Page ' + source.citation.pageNumber : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {source.state === 'checking' && <p role="status" className="text-sm">Checking access…</p>}
                {source.state === 'available' && (
                  <blockquote className="border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-900">
                    {source.citation.snippet}
                  </blockquote>
                )}
                {source.state === 'unavailable' && <p role="status" className="text-sm">This source is no longer available.</p>}
                {source.error && <ErrorState error={source.error} onRetry={() => void verifySource(source.citation)} />}
                <p className="border-t border-slate-200 pt-3 text-xs text-slate-600">
                  Extracted text only. Original files are not stored or available to preview or download.
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
