import { describe, expect, it, vi } from 'vitest'
import { ApiRequestError, createApiClient } from './client'

function mockFetch(status: number, body?: unknown) {
  return vi.fn(
    async () =>
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as unknown as typeof fetch
}

describe('api client', () => {
  it('sends auth header and bounded list query', async () => {
    const fetchImpl = mockFetch(200, {
      items: [],
      page: 0,
      size: 20,
      totalItems: 0,
    })
    const api = createApiClient({
      baseUrl: 'http://api',
      getAuthHeader: () => 'Basic abc',
      fetchImpl,
    })
    await api.listDocuments({ status: 'INDEXED', size: 20 })
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0]
    expect(url).toBe('http://api/api/v1/documents?status=INDEXED&size=20')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Basic abc')
  })

  it('posts chat queries as JSON', async () => {
    const fetchImpl = mockFetch(200, {
      answer: null,
      insufficientEvidence: true,
      citations: [],
      correlationId: 'c',
      timingMs: 1,
      retrievalMs: 0,
    })
    const api = createApiClient({ baseUrl: '', fetchImpl })
    const res = await api.queryChat({ question: 'hi' })
    expect(res.insufficientEvidence).toBe(true)
    expect(vi.mocked(fetchImpl).mock.calls[0][1]?.body).toBe(
      '{"question":"hi"}',
    )
  })

  it('maps error envelope to ApiRequestError', async () => {
    const api = createApiClient({
      baseUrl: '',
      fetchImpl: mockFetch(404, {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        correlationId: 'abc',
      }),
    })
    await expect(api.getDocument('x')).rejects.toMatchObject({
      status: 404,
      error: { code: 'NOT_FOUND', correlationId: 'abc' },
    })
    await expect(api.getDocument('x')).rejects.toBeInstanceOf(ApiRequestError)
  })

  it('handles non-JSON errors and 204 responses', async () => {
    const bad = createApiClient({
      baseUrl: '',
      fetchImpl: vi.fn(
        async () => new Response('oops', { status: 502 }),
      ) as unknown as typeof fetch,
    })
    await expect(bad.me()).rejects.toMatchObject({
      status: 502,
      error: { code: 'UNKNOWN' },
    })
    const ok = createApiClient({ baseUrl: '', fetchImpl: mockFetch(204) })
    await expect(ok.deleteDocument('1')).resolves.toBeUndefined()
  })

  it('uploads multipart with metadata', async () => {
    const fetchImpl = mockFetch(202, {
      documentId: 'd',
      status: 'QUEUED',
      statusUrl: '/x',
    })
    const api = createApiClient({ baseUrl: '', fetchImpl })
    await api.uploadDocument({
      file: new File(['a'], 'a.txt'),
      collectionId: 'c1',
      tags: ['hr', 'policy'],
    })
    const body = vi.mocked(fetchImpl).mock.calls[0][1]?.body as FormData
    expect(body.get('collectionId')).toBe('c1')
    expect(body.getAll('tags')).toEqual(['hr', 'policy'])
  })
})
