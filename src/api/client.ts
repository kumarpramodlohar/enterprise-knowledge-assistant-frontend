import { config } from '../app/config'
import type {
  ApiError,
  ChatQueryRequest,
  ChatQueryResponse,
  DocumentListQuery,
  DocumentPage,
  DocumentResponse,
  Me,
  UploadAcceptedResponse,
  UploadRequest,
} from './types'

export class ApiRequestError extends Error {
  readonly status: number
  readonly error: ApiError

  constructor(status: number, error: ApiError) {
    super(error.message)
    this.status = status
    this.error = error
  }
}

export type TokenProvider = () => string | null | Promise<string | null>

export interface ApiClientOptions {
  baseUrl?: string
  getAuthHeader?: TokenProvider
  fetchImpl?: typeof fetch
  /** Called on every 401 so the app can drop its session. */
  onUnauthorized?: () => void
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? config.apiBaseUrl
  const doFetch = options.fetchImpl ?? fetch

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T | undefined> {
    const headers = new Headers(init.headers)
    const auth = await options.getAuthHeader?.()
    if (auth) headers.set('Authorization', auth)
    let res: Response
    try {
      res = await doFetch(`${baseUrl}${path}`, { ...init, headers })
    } catch {
      throw new ApiRequestError(0, {
        code: 'NETWORK_ERROR',
        message: 'Network error',
        correlationId: '',
      })
    }
    if (res.status === 401) options.onUnauthorized?.()
    if (!res.ok) {
      const fallback: ApiError = {
        code: 'UNKNOWN',
        message: 'Request failed',
        correlationId: res.headers.get('X-Correlation-Id') ?? '',
      }
      const body = (await res.json().catch(() => null)) as ApiError | null
      throw new ApiRequestError(res.status, body?.code ? body : fallback)
    }
    if (res.status === 204) return undefined
    return (await res.json()) as T
  }

  const json = (body: unknown): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    me: () => request<Me>('/api/v1/me') as Promise<Me>,

    listDocuments(query: DocumentListQuery = {}) {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value))
      }
      const qs = params.size ? `?${params}` : ''
      return request<DocumentPage>(
        `/api/v1/documents${qs}`,
      ) as Promise<DocumentPage>
    },

    getDocument: (id: string) =>
      request<DocumentResponse>(
        `/api/v1/documents/${encodeURIComponent(id)}`,
      ) as Promise<DocumentResponse>,

    uploadDocument(req: UploadRequest) {
      const form = new FormData()
      form.set('file', req.file)
      form.set('collectionId', req.collectionId)
      if (req.version) form.set('version', req.version)
      if (req.documentType) form.set('documentType', req.documentType)
      req.tags?.forEach((tag) => form.append('tags', tag))
      return request<UploadAcceptedResponse>('/api/v1/documents', {
        method: 'POST',
        body: form,
      }) as Promise<UploadAcceptedResponse>
    },

    reindexDocument: (id: string) =>
      request<DocumentResponse>(
        `/api/v1/documents/${encodeURIComponent(id)}/reindex`,
        { method: 'POST' },
      ) as Promise<DocumentResponse>,

    async deleteDocument(id: string) {
      await request<void>(`/api/v1/documents/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    },

    queryChat: (req: ChatQueryRequest) =>
      request<ChatQueryResponse>(
        '/api/v1/chat/query',
        json(req),
      ) as Promise<ChatQueryResponse>,
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
