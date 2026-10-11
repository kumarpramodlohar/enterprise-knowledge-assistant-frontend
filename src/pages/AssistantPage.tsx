import { useState, type FormEvent } from 'react'
import type { ChatQueryResponse, Citation } from '../api/types'
import { ApiRequestError } from '../api/client'
import { toUiError, type UiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { ErrorState } from '../components/StateViews'

function CitationView({ citation, api }: { citation: Citation; api: ReturnType<typeof useAuth>['api'] }) {
  const [state, setState] = useState<'closed' | 'checking' | 'available' | 'unavailable' | 'error'>('closed')
  const [error, setError] = useState<UiError | null>(null)

  async function verifySource() {
    setState('checking')
    setError(null)
    try {
      const document = await api.getDocument(citation.documentId)
      setState(document.status === 'INDEXED' ? 'available' : 'unavailable')
    } catch (cause) {
      if (cause instanceof ApiRequestError && cause.status === 404) {
        setState('unavailable')
      } else {
        setState('error')
        setError(toUiError(cause))
      }
    }
  }

  return (
    <li>
      <strong>{citation.fileName}</strong>
      {citation.pageNumber != null && <span> · Page {citation.pageNumber}</span>}
      {citation.section && <span> · {citation.section}</span>}
      {state !== 'available' && (
        <button type="button" disabled={state === 'checking'} onClick={() => void verifySource()}>
          {state === 'checking' ? 'Checking access…' : 'Verify and view source'}
        </button>
      )}
      {state === 'available' && <blockquote>{citation.snippet}</blockquote>}
      {state === 'unavailable' && <p role="status">This source is no longer available.</p>}
      {error && <ErrorState error={error} onRetry={() => void verifySource()} />}
    </li>
  )
}

export function AssistantPage() {
  const { api, state } = useAuth()
  const [question, setQuestion] = useState('')
  const [collectionId, setCollectionId] = useState('')
  const [version, setVersion] = useState('')
  const [documentType, setDocumentType] = useState('')
  const [tags, setTags] = useState('')
  const [result, setResult] = useState<ChatQueryResponse | null>(null)
  const [error, setError] = useState<UiError | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    setResult(null)
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

  const me = state.status === 'authenticated' ? state.me : null
  return (
    <section>
      <h1>Assistant</h1>
      {me ? (
        <form onSubmit={submit}>
          <label htmlFor="question">Question</label>
          <textarea id="question" value={question} maxLength={2000} required onChange={(event) => setQuestion(event.target.value)} />
          <label htmlFor="collection">Collection (optional)</label>
          <select id="collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
            <option value="">All accessible collections</option>
            {me.readableCollectionIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
          <label htmlFor="version">Version (optional)</label>
          <input id="version" maxLength={100} value={version} onChange={(event) => setVersion(event.target.value)} />
          <label htmlFor="document-type">Document type (optional)</label>
          <input id="document-type" maxLength={100} value={documentType} onChange={(event) => setDocumentType(event.target.value)} />
          <label htmlFor="tags">Tags (comma-separated, optional)</label>
          <input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} />
          <button disabled={pending || !question.trim()}>{pending ? 'Searching…' : 'Ask'}</button>
        </form>
      ) : (
        <p>Sign in to ask questions about documents you can access.</p>
      )}
      {error && <ErrorState error={error} />}
      {result && (
        <section aria-live="polite" aria-label="Answer">
          {result.insufficientEvidence ? <h2>Insufficient evidence</h2> : <h2>Answer</h2>}
          <p>{result.answer ?? "I couldn't find enough evidence in the documents you can access to answer that."}</p>
          {result.citations.length > 0 && (
            <ol aria-label="Sources">
                {result.citations.map((citation) => (
                  <CitationView key={citation.chunkId} citation={citation} api={api} />
                ))}
            </ol>
          )}
          <small>Request reference: {result.correlationId}</small>
        </section>
      )}
    </section>
  )
}
