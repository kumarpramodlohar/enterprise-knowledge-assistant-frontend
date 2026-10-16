import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import { ApiRequestError, type ApiClient } from '../api/client'
import type { ChatQueryResponse } from '../api/types'
import { AssistantPage } from './AssistantPage'

function renderPage(queryResult: ChatQueryResponse = {
  answer: 'A safe answer',
  insufficientEvidence: false,
  citations: [{
    documentId: 'doc',
    fileName: '<img src=x onerror=alert(1)>',
    chunkId: 'chunk',
    snippet: '<script>alert(1)</script> excerpt',
  }],
  correlationId: 'req-1',
  timingMs: 12,
  retrievalMs: 4,
}) {
  const api = {
    queryChat: vi.fn().mockResolvedValue(queryResult),
    getDocument: vi.fn().mockResolvedValue({ status: 'INDEXED' }),
  } as unknown as ApiClient
  const value: AuthContextValue = {
    api,
    state: {
      status: 'authenticated',
      me: {
        subject: 'reader',
        role: 'MEMBER',
        readableCollectionIds: ['collection-1'],
        manageableCollectionIds: [],
      },
    },
    signInWithAuthHeader: vi.fn(),
    signInWithBasic: vi.fn(),
    signOut: vi.fn(),
  }
  return { api, ...render(<AuthContext.Provider value={value}><AssistantPage /></AuthContext.Provider>) }
}

it('submits a question and renders answer and citations as inert text', async () => {
  const { api } = renderPage()
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What is the policy?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  await waitFor(() => expect(api.queryChat).toHaveBeenCalledWith({
    question: 'What is the policy?',
    filters: undefined,
  }))
  expect(await screen.findByText('A safe answer')).toBeInTheDocument()
  expect(screen.getByText('[1] <img src=x onerror=alert(1)>')).toBeInTheDocument()
  expect(document.querySelector('img')).toBeNull()
  expect(screen.queryByText('<script>alert(1)</script> excerpt')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Verify and view source' }))
  expect(await screen.findByText('<script>alert(1)</script> excerpt')).toBeInTheDocument()
  expect(api.getDocument).toHaveBeenCalledWith('doc')
  expect(document.querySelector('script')).toBeNull()
})

it('shows insufficient evidence distinctly', async () => {
  renderPage({
    answer: null,
    insufficientEvidence: true,
    citations: [],
    correlationId: 'req-2',
    timingMs: 2,
    retrievalMs: 1,
  })
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Unknown?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  expect(await screen.findByRole('heading', { name: 'Insufficient evidence' })).toBeInTheDocument()
})

it('submits selected collection and metadata filters', async () => {
  const { api } = renderPage()
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What is the policy?' } })
  fireEvent.change(screen.getByLabelText('Search in'), { target: { value: 'collection-1' } })
  fireEvent.change(screen.getByLabelText('Version (optional)'), { target: { value: '2026' } })
  fireEvent.change(screen.getByLabelText('Document type (optional)'), { target: { value: 'policy' } })
  fireEvent.change(screen.getByLabelText('Tags (comma-separated, optional)'), { target: { value: 'hr, approved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  await waitFor(() => expect(api.queryChat).toHaveBeenCalledWith({
    question: 'What is the policy?',
    filters: {
      collectionIds: ['collection-1'],
      version: '2026',
      documentType: 'policy',
      tags: ['hr', 'approved'],
    },
  }))
})

it('does not show a citation excerpt when the source is no longer accessible', async () => {
  const { api } = renderPage()
  vi.mocked(api.getDocument).mockRejectedValue(new ApiRequestError(404, {
    code: 'NOT_FOUND',
    message: 'not found',
    correlationId: 'request-missing-source',
  }))
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What is the policy?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  await screen.findByText('A safe answer')
  fireEvent.click(screen.getByRole('button', { name: 'Verify and view source' }))
  expect(await screen.findByText('This source is no longer available.')).toBeInTheDocument()
  expect(screen.queryByText('<script>alert(1)</script> excerpt')).not.toBeInTheDocument()
})

it('does not submit a second question while the first is pending', async () => {
  let resolveQuery: ((response: ChatQueryResponse) => void) | undefined
  const pending = new Promise<ChatQueryResponse>((resolve) => {
    resolveQuery = resolve
  })
  const { api } = renderPage()
  vi.mocked(api.queryChat).mockReturnValue(pending)
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'What is the policy?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Ask' }))
  await waitFor(() => expect(api.queryChat).toHaveBeenCalledTimes(1))
  expect(screen.getByRole('button', { name: 'Searching…' })).toBeDisabled()
  fireEvent.submit(screen.getByRole('button', { name: 'Searching…' }).closest('form')!)
  expect(api.queryChat).toHaveBeenCalledTimes(1)
  resolveQuery?.({
    answer: null,
    insufficientEvidence: true,
    citations: [],
    correlationId: 'req-pending',
    timingMs: 1,
    retrievalMs: 1,
  })
})
