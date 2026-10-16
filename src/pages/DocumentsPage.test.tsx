import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import { ApiRequestError, type ApiClient } from '../api/client'
import { DocumentsPage } from './DocumentsPage'

const document = {
  id: 'doc-1',
  collectionId: 'collection-1',
  fileName: 'guide.txt',
  contentType: 'text/plain',
  sizeBytes: 20,
  status: 'QUEUED' as const,
  tags: [],
  createdAt: '',
  updatedAt: '',
}

function renderPage(overrides: Partial<ApiClient> = {}, manageableCollectionIds = ['collection-1']) {
  const api = {
    listDocuments: vi.fn().mockResolvedValue({
      items: [document],
      page: 0,
      size: 100,
      totalItems: 1,
    }),
    uploadDocument: vi.fn().mockResolvedValue({
      documentId: 'doc-2',
      status: 'QUEUED',
      statusUrl: '/api/v1/documents/doc-2',
    }),
    reindexDocument: vi.fn(),
    deleteDocument: vi.fn(),
    ...overrides,
  } as unknown as ApiClient
  const value: AuthContextValue = {
    api,
    state: {
      status: 'authenticated',
      me: {
        subject: 'manager',
        role: 'MEMBER',
        readableCollectionIds: ['collection-1'],
        manageableCollectionIds,
      },
    },
    signInWithAuthHeader: vi.fn(),
    signInWithBasic: vi.fn(),
    oidcEnabled: false,
    signInWithOidc: vi.fn(),
    completeOidcSignIn: vi.fn(),
    signOut: vi.fn(),
  }
  return { ...render(<AuthContext.Provider value={value}><DocumentsPage /></AuthContext.Provider>), api }
}

describe('DocumentsPage', () => {
  it('shows lifecycle controls and status for documents in manageable collections', async () => {
    renderPage()
    expect(await screen.findByText('Status: QUEUED')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Re-index' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('uploads a supported file and explains that accepted work is not yet indexed', async () => {
    const { api } = renderPage()
    await screen.findByText('Status: QUEUED')
    fireEvent.change(screen.getByLabelText('Upload collection'), { target: { value: 'collection-1' } })
    const file = new File(['content'], 'new.txt', { type: 'text/plain' })
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } })
    fireEvent.submit(screen.getByRole('form', { name: 'Upload document' }))
    await waitFor(() => expect(api.uploadDocument).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent(/Upload accepted \(QUEUED\)/)
  })

  it('shows a safe duplicate-upload message without exposing the API message', async () => {
    const { api } = renderPage({
      uploadDocument: vi.fn().mockRejectedValue(new ApiRequestError(409, {
        code: 'DUPLICATE_DOCUMENT',
        message: 'internal duplicate detail',
        correlationId: 'request-duplicate',
      })),
    })
    await screen.findByText('Status: QUEUED')
    fireEvent.change(screen.getByLabelText('Upload collection'), { target: { value: 'collection-1' } })
    fireEvent.change(screen.getByLabelText('File'), {
      target: { files: [new File(['content'], 'duplicate.txt', { type: 'text/plain' })] },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Upload document' }))
    expect(await screen.findByText('This document already exists in the collection.')).toBeInTheDocument()
    expect(screen.queryByText('internal duplicate detail')).not.toBeInTheDocument()
    expect(api.uploadDocument).toHaveBeenCalled()
  })

  it('hides upload and document write actions for read-only collections', async () => {
    renderPage({}, [])
    expect(await screen.findByText('Status: QUEUED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Re-index' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'collection-1' } })
    expect(screen.queryByRole('form', { name: 'Upload document' })).not.toBeInTheDocument()
  })

  it('refreshes lifecycle state after a re-index request', async () => {
    const { api } = renderPage({
      reindexDocument: vi.fn().mockResolvedValue({ ...document, status: 'QUEUED' }),
    })
    expect(await screen.findByText('Status: QUEUED')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Re-index' }))
    await waitFor(() => expect(api.reindexDocument).toHaveBeenCalledWith('doc-1'))
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('status')).toHaveTextContent('Re-index request accepted.')
  })

  it('deletes a document and refreshes the document list', async () => {
    const { api } = renderPage({
      listDocuments: vi.fn()
        .mockResolvedValueOnce({ items: [document], page: 0, size: 100, totalItems: 1 })
        .mockResolvedValueOnce({ items: [], page: 0, size: 100, totalItems: 0 }),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    })
    expect(await screen.findByText('Status: QUEUED')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.deleteDocument).toHaveBeenCalledWith('doc-1'))
    expect(await screen.findByText('No documents')).toBeInTheDocument()
  })

  it('labels re-index as retry when ingestion failed', async () => {
    renderPage({
      listDocuments: vi.fn().mockResolvedValue({
        items: [{ ...document, status: 'FAILED', failureReason: 'EMBEDDING_PROVIDER_FAILED' }],
        page: 0,
        size: 100,
        totalItems: 1,
      }),
    })
    expect(await screen.findByText('Status: FAILED (EMBEDDING_PROVIDER_FAILED)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
