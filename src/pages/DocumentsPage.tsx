import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { DocumentPage, DocumentResponse, DocumentStatus } from '../api/types'
import { toUiError, type UiError } from '../api/errors'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'

const inputClass =
  'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600'

const statusLabels: Record<DocumentStatus, string> = {
  QUEUED: 'Queued',
  PROCESSING: 'Processing',
  INDEXED: 'Ready',
  FAILED: 'Failed',
}

const failureMessages: Record<string, string> = {
  CORRUPT: 'The file could not be read. Upload a valid copy to try again.',
  EMPTY: 'No searchable text was found in this file.',
  TOO_LARGE: 'The extracted content exceeds the allowed size.',
  ENCRYPTED: 'The file is encrypted. Upload an unlocked copy to try again.',
  UNSUPPORTED_TYPE: 'This file type is not supported.',
  EXTRACTION_FAILED: 'Text could not be extracted. Try uploading the file again.',
  EMBEDDING_PROVIDER_FAILED: 'Search indexing failed. You can retry this document.',
  EMBEDDING_PROVIDER_TIMEOUT: 'Search indexing timed out. You can retry this document.',
  UNKNOWN: 'Processing failed. You can retry this document.',
}

function statusClass(status: DocumentStatus): string {
  if (status === 'INDEXED') return 'bg-indigo-50 text-indigo-700'
  if (status === 'FAILED') return 'bg-red-50 text-red-700'
  if (status === 'PROCESSING') return 'bg-amber-50 text-amber-800'
  return 'bg-slate-100 text-slate-700'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileType(document: DocumentResponse): string {
  const extension = document.fileName.split('.').pop()?.toUpperCase()
  if (extension && ['PDF', 'DOCX', 'TXT', 'MD', 'MARKDOWN'].includes(extension)) {
    return extension === 'MARKDOWN' ? 'Markdown' : extension
  }
  return document.contentType || 'Document'
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
}

function failureMessage(reason?: string | null): string | null {
  if (!reason) return null
  return failureMessages[reason] ?? 'Processing failed. You can retry this document.'
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass(status)}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabels[status]}
    </span>
  )
}

function FileIcon() {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </svg>
    </span>
  )
}

function SummaryCard({ value, label, tone = 'normal' }: { value: number; label: string; tone?: 'normal' | 'danger' }) {
  return (
    <div className="flex min-h-[78px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <span className={`text-2xl font-semibold tabular-nums ${tone === 'danger' ? 'text-red-700' : 'text-slate-900'}`}>
        {value}
      </span>
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  )
}

export function DocumentsPage() {
  const { api, state } = useAuth()
  const me = state.status === 'authenticated' ? state.me : null
  const collections = me?.readableCollectionIds ?? []
  const manageable = useMemo(() => new Set(me?.manageableCollectionIds ?? []), [me])
  const [collectionId, setCollectionId] = useState('')
  const [status, setStatus] = useState<DocumentStatus | ''>('')
  const [page, setPage] = useState<DocumentPage | null>(null)
  const documents = page?.items ?? []
  const [loading, setLoading] = useState(Boolean(me))
  const [error, setError] = useState<UiError | null>(null)
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentResponse | null>(null)
  const [selectedDetails, setSelectedDetails] = useState<DocumentResponse | null>(null)
  const pollAttempts = useRef(0)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  const detailsDialog = useRef<HTMLDialogElement>(null)

  const requestDocuments = useCallback(() => {
    if (!me) return Promise.resolve(null)
    return api.listDocuments({
      ...(collectionId ? { collectionId } : {}),
      ...(status ? { status } : {}),
      page: 0,
      size: 100,
    })
  }, [api, collectionId, me, status])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await requestDocuments()
      if (!result) return
      setPage(result)
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
    setPage(null)
    setLoading(true)
    void requestDocuments()
      .then((result: DocumentPage | null) => {
        if (!active || !result) return
        setPage(result)
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

  useEffect(() => {
    pollAttempts.current = 0
  }, [collectionId, status])

  useEffect(() => {
    const hasPendingIngestion = documents.some((document) => document.status === 'QUEUED' || document.status === 'PROCESSING')
    if (!hasPendingIngestion || pollAttempts.current >= 12) return
    const timeout = window.setTimeout(() => {
      pollAttempts.current += 1
      void refresh()
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [documents, refresh])

  useEffect(() => {
    const element = deleteDialog.current
    if (!element) return
    if (pendingDelete && !element.open) {
      if (typeof element.showModal === 'function') element.showModal()
      else element.setAttribute('open', '')
    }
    if (!pendingDelete && element.open) {
      if (typeof element.close === 'function') element.close()
      else element.removeAttribute('open')
    }
  }, [pendingDelete])

  useEffect(() => {
    const element = detailsDialog.current
    if (!element) return
    if (selectedDetails && !element.open) {
      if (typeof element.showModal === 'function') element.showModal()
      else element.setAttribute('open', '')
    }
    if (!selectedDetails && element.open) {
      if (typeof element.close === 'function') element.close()
      else element.removeAttribute('open')
    }
  }, [selectedDetails])

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
      setMessage(`Upload accepted (${statusLabels[result.status]}). Processing may take a while; refresh status to check progress.`)
      form.reset()
      setUploadOpen(false)
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
      setPendingDelete(null)
      setMessage(action === 'delete' ? 'Document deleted.' : 'Re-index request accepted.')
      await refresh()
    } catch (cause) {
      setError(toUiError(cause))
    } finally {
      setBusyId(null)
    }
  }

  const counts = useMemo(() => ({
    shown: documents.length,
    ready: documents.filter((doc) => doc.status === 'INDEXED').length,
    processing: documents.filter((doc) => doc.status === 'QUEUED' || doc.status === 'PROCESSING').length,
    failed: documents.filter((doc) => doc.status === 'FAILED').length,
  }), [documents])

  if (!me) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-[28px] font-bold text-slate-900">Documents</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to view documents you are allowed to access.</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-7 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-10 text-slate-900">Documents</h1>
          <p className="mt-1 text-sm leading-6 text-slate-600">Manage extracted knowledge across your permitted collections.</p>
        </div>
        {manageable.size > 0 && (
          <button
            type="button"
            onClick={() => setUploadOpen((open) => !open)}
            className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-md bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 sm:self-auto"
            aria-expanded={uploadOpen}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
            </svg>
            {uploadOpen ? 'Close upload' : 'Upload documents'}
          </button>
        )}
      </div>

      {uploadOpen && manageable.size > 0 && (
        <form id="document-upload" onSubmit={upload} aria-label="Upload document" className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add a document</h2>
              <p className="mt-1 text-sm text-slate-600">PDF, DOCX, TXT, or Markdown · up to 10 MB</p>
            </div>
            <span className="mt-1 text-xs text-slate-500">Accepted uploads enter the processing queue.</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Collection <span className="sr-only">(required)</span>
              <select name="uploadCollectionId" required defaultValue="" className={inputClass}>
                <option value="" disabled>Select a collection</option>
                {[...manageable].map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-2">
              File <span className="sr-only">(required)</span>
              <input name="file" type="file" accept=".pdf,.docx,.txt,.md,.markdown" required className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600" />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Version <span className="font-normal text-slate-500">(optional)</span>
              <input name="version" maxLength={100} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              Document type <span className="font-normal text-slate-500">(optional)</span>
              <input name="documentType" maxLength={100} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
              Tags <span className="font-normal text-slate-500">(comma-separated, optional)</span>
              <input name="tags" className={inputClass} />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="submit" disabled={busyId === 'upload'} className="h-10 rounded-md bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
              {busyId === 'upload' ? 'Uploading…' : 'Upload document'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <SummaryCard value={counts.shown} label="Shown in this result set" />
        <SummaryCard value={counts.ready} label="Ready" />
        <SummaryCard value={counts.processing} label="Processing" />
        <SummaryCard value={counts.failed} label="Needs attention" tone="danger" />
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Your documents</h2>
          <p className="mt-1 text-xs text-slate-500" aria-live="polite">
            {page ? `${page.totalItems} permitted ${page.totalItems === 1 ? 'document' : 'documents'}` : 'Loading document totals…'}
            {page && page.totalItems > documents.length ? ` · Showing ${documents.length} of ${page.totalItems}` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
            <span className="sr-only">Collection</span>
            <select aria-label="Collection" value={collectionId} onChange={(event) => setCollectionId(event.target.value)} className={`${inputClass} min-w-52`}>
              <option value="">All accessible collections</option>
              {collections.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
            <span className="sr-only">Status</span>
            <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as DocumentStatus | '')} className={`${inputClass} min-w-40`}>
              <option value="">All statuses</option>
              <option value="QUEUED">Queued</option>
              <option value="PROCESSING">Processing</option>
              <option value="INDEXED">Ready</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11a8.1 8.1 0 0 0-14.9-4L3 10m0-6v6h6M4 13a8.1 8.1 0 0 0 14.9 4L21 14m0 6v-6h-6" />
            </svg>
            {loading ? 'Refreshing…' : 'Refresh status'}
          </button>
        </div>
      </div>

      {message && <p role="status" className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
      {error && <div className="mt-4"><ErrorState error={error} onRetry={() => void refresh()} /></div>}

      {!loading && documents.length > 0 && <div className="mt-4 hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">Document</th>
                <th scope="col" className="px-4 py-3">Collection</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Updated</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            {!loading && documents.length > 0 && (
              <tbody className="divide-y divide-slate-200">
                {documents.map((doc) => {
                  const canManage = manageable.has(doc.collectionId)
                  const failure = failureMessage(doc.failureReason)
                  return (
                    <tr key={doc.id} className="align-middle hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <FileIcon />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900" title={doc.fileName}>{doc.fileName}</p>
                            <p className="mt-1 text-xs text-slate-500">{fileType(doc)} · {formatBytes(doc.sizeBytes)}</p>
                            {failure && <p className="mt-1 max-w-xs text-xs text-red-700">{failure}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-600"><span className="block max-w-40 truncate" title={doc.collectionId}>{doc.collectionId}</span></td>
                      <td className="px-4 py-4"><StatusBadge status={doc.status} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600"><span className="block text-slate-900">{formatTime(doc.updatedAt)}</span><span className="mt-1 block text-[10px]">{formatDate(doc.updatedAt)}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setSelectedDetails(doc)} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">Details</button>
                          {canManage && (
                            <button type="button" disabled={busyId === doc.id} onClick={() => void manage(doc.id, 'reindex')} className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50">
                              {busyId === doc.id ? 'Working…' : doc.status === 'FAILED' ? 'Retry' : 'Re-index'}
                            </button>
                          )}
                          {canManage && (
                            <button type="button" disabled={busyId === doc.id} onClick={() => setPendingDelete(doc)} className="h-8 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )}
          </table>
        </div>
        {!loading && documents.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{documents.length > 0 ? `Showing ${documents.length} document${documents.length === 1 ? '' : 's'} · ${page?.totalItems ?? 0} total across permitted collections` : ''}</span>
            <span>Only extracted text and metadata are retained; original files are not stored.</span>
          </div>
        )}
      </div>}

      {loading ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6"><LoadingState label="Loading documents…" /></div>
      ) : documents.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
          <EmptyState title={error ? 'Documents could not be loaded' : 'No documents'}>
            <p className="mt-1 text-sm text-slate-600">{error ? 'Refresh to try again.' : 'No documents are visible in this collection and status.'}</p>
          </EmptyState>
        </div>
      ) : (
        <ul aria-label="Document list" className="mt-4 grid gap-3 lg:hidden">
          {documents.map((doc) => {
            const canManage = manageable.has(doc.collectionId)
            const failure = failureMessage(doc.failureReason)
            return (
              <li key={doc.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <FileIcon />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-slate-900">{doc.fileName}</p>
                    <p className="mt-1 text-xs text-slate-500">{fileType(doc)} · {formatBytes(doc.sizeBytes)}</p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-slate-100 pt-3 text-xs">
                  <div><dt className="text-slate-500">Collection</dt><dd className="mt-1 break-all font-medium text-slate-800">{doc.collectionId}</dd></div>
                  <div><dt className="text-slate-500">Updated</dt><dd className="mt-1 font-medium text-slate-800">{formatDate(doc.updatedAt)}</dd></div>
                  {doc.documentType && <div><dt className="text-slate-500">Type</dt><dd className="mt-1 font-medium text-slate-800">{doc.documentType}</dd></div>}
                  {doc.version && <div><dt className="text-slate-500">Version</dt><dd className="mt-1 font-medium text-slate-800">{doc.version}</dd></div>}
                </dl>
                {failure && <p className="mt-3 rounded-md bg-red-50 p-2.5 text-xs text-red-800">{failure}</p>}
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <button type="button" onClick={() => setSelectedDetails(doc)} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">Details</button>
                  {canManage && (
                    <>
                      <button type="button" disabled={busyId === doc.id} onClick={() => void manage(doc.id, 'reindex')} className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-50">
                        {busyId === doc.id ? 'Working…' : doc.status === 'FAILED' ? 'Retry' : 'Re-index'}
                      </button>
                      <button type="button" disabled={busyId === doc.id} onClick={() => setPendingDelete(doc)} className="h-9 rounded-md border border-red-200 bg-white px-3 text-xs font-medium text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50">Delete</button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {!loading && documents.length > 0 && (
        <p className="mt-3 text-xs text-slate-500 lg:hidden">Only extracted text and metadata are retained; original files are not stored.</p>
      )}

      <dialog
        ref={detailsDialog}
        aria-labelledby="details-title"
        onCancel={(event) => { event.preventDefault(); setSelectedDetails(null) }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
      >
        {selectedDetails && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <FileIcon />
                <div className="min-w-0">
                  <h2 id="details-title" className="break-words text-lg font-semibold">{selectedDetails.fileName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{fileType(selectedDetails)} · {formatBytes(selectedDetails.sizeBytes)}</p>
                </div>
              </div>
              <StatusBadge status={selectedDetails.status} />
            </div>
            <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-medium text-slate-500">Collection</dt><dd className="mt-1 break-all text-slate-900">{selectedDetails.collectionId}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Last updated</dt><dd className="mt-1 text-slate-900">{formatDate(selectedDetails.updatedAt)}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Document type</dt><dd className="mt-1 text-slate-900">{selectedDetails.documentType || 'Not specified'}</dd></div>
              <div><dt className="text-xs font-medium text-slate-500">Version</dt><dd className="mt-1 text-slate-900">{selectedDetails.version || 'Not specified'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-xs font-medium text-slate-500">Tags</dt><dd className="mt-1 text-slate-900">{selectedDetails.tags.length ? selectedDetails.tags.join(', ') : 'No tags'}</dd></div>
            </dl>
            {failureMessage(selectedDetails.failureReason) && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{failureMessage(selectedDetails.failureReason)}</p>}
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setSelectedDetails(null)} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">Close</button>
            </div>
          </>
        )}
      </dialog>

      <dialog
        ref={deleteDialog}
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
        onCancel={(event) => { event.preventDefault(); setPendingDelete(null) }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/40"
      >
        {pendingDelete && (
          <>
            <h2 id="delete-title" className="text-lg font-semibold">Delete this document?</h2>
            <p id="delete-description" className="mt-2 break-words text-sm text-slate-600">“{pendingDelete.fileName}” will be excluded from listings and retrieval immediately. Permanent cleanup occurs after 7 days.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPendingDelete(null)} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">Cancel</button>
              <button type="button" disabled={busyId === pendingDelete.id} onClick={() => void manage(pendingDelete.id, 'delete')} className="h-10 rounded-md bg-red-700 px-4 text-sm font-medium text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-60">{busyId === pendingDelete.id ? 'Deleting…' : 'Delete document'}</button>
            </div>
          </>
        )}
      </dialog>
    </section>
  )
}
