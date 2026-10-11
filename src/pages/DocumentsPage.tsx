import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { DocumentPage, DocumentResponse } from '../api/types'
import { toUiError, type UiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'

export function DocumentsPage() {
  const { api, state } = useAuth()
  const me = state.status === 'authenticated' ? state.me : null
  const collections = me?.readableCollectionIds ?? []
  const manageable = useMemo(() => new Set(me?.manageableCollectionIds ?? []), [me])
  const [collectionId, setCollectionId] = useState('')
  const [documents, setDocuments] = useState<DocumentResponse[]>([])
  const [loading, setLoading] = useState(Boolean(me))
  const [error, setError] = useState<UiError | null>(null)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const requestDocuments = useCallback(() => {
    if (!me) return Promise.resolve(null)
    return api.listDocuments(
      collectionId ? { collectionId, page: 0, size: 100 } : { page: 0, size: 100 },
    )
  }, [api, collectionId, me])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const page = await requestDocuments()
      if (!page) return
      setDocuments(page.items)
      setError(null)
    } catch (cause) {
      setError(toUiError(cause))
    } finally {
      setLoading(false)
    }
  }, [requestDocuments])

  useEffect(() => {
    if (!me) return
    let active = true
    void requestDocuments()
      .then((page: DocumentPage | null) => {
        if (!active || !page) return
        setDocuments(page.items)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (active) setError(toUiError(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [me, requestDocuments])

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const file = data.get('file')
    const uploadCollectionId = String(data.get('uploadCollectionId') || '')
    if (!(file instanceof File) || !uploadCollectionId) return
    setBusyId('upload')
    setError(null)
    setMessage('')
    try {
      const result = await api.uploadDocument({
        file,
        collectionId: uploadCollectionId,
        version: String(data.get('version') || '') || undefined,
        documentType: String(data.get('documentType') || '') || undefined,
        tags: String(data.get('tags') || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      })
      setMessage(`Upload accepted (${result.status}). Processing may take a while; refresh status to check progress.`)
      form.reset()
      await refresh()
    } catch (cause) {
      setError(toUiError(cause))
    } finally {
      setBusyId(null)
    }
  }

  async function manage(id: string, action: 'reindex' | 'delete') {
    setBusyId(id)
    setError(null)
    setMessage('')
    try {
      if (action === 'reindex') await api.reindexDocument(id)
      else await api.deleteDocument(id)
      setMessage(action === 'delete' ? 'Document deleted.' : 'Re-index request accepted.')
      await refresh()
    } catch (cause) {
      setError(toUiError(cause))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section>
      <h1>Documents</h1>
      {state.status !== 'authenticated' ? (
        <p>Sign in to view documents you are allowed to access.</p>
      ) : (
        <>
          <label>
            Collection
            <select value={collectionId} onChange={(event) => setCollectionId(event.target.value)}>
              <option value="">All accessible collections</option>
              {collections.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          {manageable.size > 0 && (
            <form onSubmit={upload} aria-label="Upload document">
              <h2>Upload a document</h2>
              <label>
                Upload collection
                <select name="uploadCollectionId" required defaultValue="">
                  <option value="" disabled>Select a manageable collection</option>
                  {[...manageable].map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
              <label>File <input name="file" type="file" accept=".pdf,.docx,.txt,.md,.markdown" required /></label>
              <label>Version (optional) <input name="version" maxLength={100} /></label>
              <label>Document type (optional) <input name="documentType" maxLength={100} /></label>
              <label>Tags, comma-separated (optional) <input name="tags" /></label>
              <button disabled={busyId === 'upload'}>{busyId === 'upload' ? 'Uploading…' : 'Upload'}</button>
            </form>
          )}
          <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh status</button>
          {message && <p role="status">{message}</p>}
          {error && <ErrorState error={error} onRetry={() => void refresh()} />}
          {loading ? <LoadingState label="Loading documents…" /> : documents.length ? (
            <ul aria-label="Document list">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <h2>{doc.fileName}</h2>
                  <p>Status: {doc.status}{doc.failureReason ? ` (${doc.failureReason})` : ''}</p>
                  <p>{doc.documentType ?? 'Document'}{doc.version ? ` · ${doc.version}` : ''}</p>
                  {manageable.has(doc.collectionId) && (
                    <>
                      <button type="button" disabled={busyId === doc.id} onClick={() => void manage(doc.id, 'reindex')}>
                        {doc.status === 'FAILED' ? 'Retry' : 'Re-index'}
                      </button>
                      <button type="button" disabled={busyId === doc.id} onClick={() => void manage(doc.id, 'delete')}>Delete</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No documents">
              <p>No documents are visible in this collection.</p>
            </EmptyState>
          )}
        </>
      )}
    </section>
  )
}
