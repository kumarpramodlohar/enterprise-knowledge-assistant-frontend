import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../auth/AuthContext'
import { ApiRequestError, type ApiClient } from '../api/client'
import { Layout } from '../components/Layout'
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

function renderPage(
  overrides: Partial<ApiClient> = {},
  manageableCollectionIds = ['collection-1'],
  initialEntry = '/documents',
  withLayout = false,
) {
  const api = {
    listDocuments: vi.fn().mockResolvedValue({
      items: [document],
      page: 0,
      size: 20,
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
  const page = withLayout ? (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/documents" element={<DocumentsPage />} />
      </Route>
    </Routes>
  ) : (
    <DocumentsPage />
  )
  return {
    ...render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <AuthContext.Provider value={value}>{page}</AuthContext.Provider>
      </MemoryRouter>,
    ),
    api,
  }
}

describe('DocumentsPage', () => {
  async function expectQueuedStatus() {
    expect(await screen.findAllByText('Queued', { selector: 'span' })).not.toHaveLength(0)
  }

  it('disables lifecycle controls while a document is queued', async () => {
    renderPage()
    await expectQueuedStatus()
    expect(screen.getAllByRole('button', { name: 'Re-index' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Delete' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  })

  it('searches filenames and requests 20 results per page', async () => {
    const indexed = { ...document, status: 'INDEXED' as const }
    const { api } = renderPage({
      listDocuments: vi.fn().mockResolvedValue({
        items: [indexed],
        page: 0,
        size: 20,
        totalItems: 1,
      }),
    })
    await screen.findAllByText('Ready', { selector: 'span' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search documents by filename' }), {
      target: { value: 'Guide' },
    })
    await waitFor(
      () =>
        expect(api.listDocuments).toHaveBeenLastCalledWith({
          search: 'Guide',
          page: 0,
          size: 20,
        }),
      { timeout: 1500 },
    )
  })

  it('paginates through the server result set', async () => {
    const items = Array.from({ length: 21 }, (_, index) => ({
      ...document,
      id: `doc-${index}`,
      fileName: `guide-${index}.txt`,
      status: 'INDEXED' as const,
    }))
    const listDocuments = vi.fn()
      .mockResolvedValueOnce({ items: items.slice(0, 20), page: 0, size: 20, totalItems: 21 })
      .mockResolvedValueOnce({ items: items.slice(20), page: 1, size: 20, totalItems: 21 })
    renderPage({ listDocuments })
    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    expect(listDocuments).toHaveBeenLastCalledWith({ page: 1, size: 20 })
  })

  it('opens the existing upload form from the Upload navigation item', async () => {
    renderPage({}, ['collection-1'], '/documents', true)
    await expectQueuedStatus()
    fireEvent.click(screen.getByRole('link', { name: 'Upload' }))
    expect(await screen.findByRole('form', { name: 'Upload document' })).toBeInTheDocument()
  })

  it('opens the upload form when arriving from the Upload navigation URL', async () => {
    renderPage({}, ['collection-1'], '/documents?upload=1')
    expect(await screen.findByRole('form', { name: 'Upload document' })).toBeInTheDocument()
  })

  it('uploads a supported file and explains that accepted work is not yet indexed', async () => {
    const { api } = renderPage()
    await expectQueuedStatus()
    fireEvent.click(screen.getByRole('button', { name: 'Upload documents' }))
    fireEvent.change(within(screen.getByRole('form', { name: 'Upload document' })).getByRole('combobox'), {
      target: { value: 'collection-1' },
    })
    const file = new File(['content'], 'new.txt', { type: 'text/plain' })
    fireEvent.change(within(screen.getByRole('form', { name: 'Upload document' })).getByLabelText(/File/), {
      target: { files: [file] },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Upload document' }))
    await waitFor(() => expect(api.uploadDocument).toHaveBeenCalled())
    expect(await screen.findByRole('status')).toHaveTextContent(/Upload accepted \(Queued\)/)
  })

  it('shows a safe duplicate-upload message without exposing the API message', async () => {
    const { api } = renderPage({
      uploadDocument: vi.fn().mockRejectedValue(new ApiRequestError(409, {
        code: 'DUPLICATE_DOCUMENT',
        message: 'internal duplicate detail',
        correlationId: 'request-duplicate',
      })),
    })
    await expectQueuedStatus()
    fireEvent.click(screen.getByRole('button', { name: 'Upload documents' }))
    fireEvent.change(within(screen.getByRole('form', { name: 'Upload document' })).getByRole('combobox'), {
      target: { value: 'collection-1' },
    })
    fireEvent.change(within(screen.getByRole('form', { name: 'Upload document' })).getByLabelText(/File/), {
      target: { files: [new File(['content'], 'duplicate.txt', { type: 'text/plain' })] },
    })
    fireEvent.submit(screen.getByRole('form', { name: 'Upload document' }))
    expect(await screen.findByText('This document already exists in the collection.')).toBeInTheDocument()
    expect(screen.queryByText('internal duplicate detail')).not.toBeInTheDocument()
    expect(api.uploadDocument).toHaveBeenCalled()
  })

  it('hides upload and document write actions for read-only collections', async () => {
    renderPage({}, [])
    await expectQueuedStatus()
    expect(screen.queryByRole('button', { name: 'Re-index' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'collection-1' } })
    expect(screen.queryByRole('form', { name: 'Upload document' })).not.toBeInTheDocument()
  })

  it('refreshes lifecycle state after a re-index request', async () => {
    const indexed = { ...document, status: 'INDEXED' as const }
    const { api } = renderPage({
      listDocuments: vi.fn()
        .mockResolvedValueOnce({ items: [indexed], page: 0, size: 20, totalItems: 1 })
        .mockResolvedValueOnce({ items: [{ ...indexed, status: 'QUEUED' }], page: 0, size: 20, totalItems: 1 }),
      reindexDocument: vi.fn().mockResolvedValue({ ...indexed, status: 'QUEUED' }),
    })
    await screen.findAllByText('Ready', { selector: 'span' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Re-index' })[0])
    await waitFor(() => expect(api.reindexDocument).toHaveBeenCalledWith('doc-1'))
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('status')).toHaveTextContent('Re-index request accepted.')
  })

  it('deletes a document and refreshes the document list', async () => {
    const indexed = { ...document, status: 'INDEXED' as const }
    const { api } = renderPage({
      listDocuments: vi.fn()
        .mockResolvedValueOnce({ items: [indexed], page: 0, size: 20, totalItems: 1 })
        .mockResolvedValueOnce({ items: [], page: 0, size: 20, totalItems: 0 }),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    })
    await screen.findAllByText('Ready', { selector: 'span' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete document' }))
    await waitFor(() => expect(api.deleteDocument).toHaveBeenCalledWith('doc-1'))
    expect(await screen.findByText('No documents')).toBeInTheDocument()
  })

  it('labels re-index as retry when ingestion failed', async () => {
    renderPage({
      listDocuments: vi.fn().mockResolvedValue({
        items: [{ ...document, status: 'FAILED', failureReason: 'EMBEDDING_PROVIDER_FAILED' }],
        page: 0,
        size: 20,
        totalItems: 1,
      }),
    })
    expect(await screen.findAllByText('Failed', { selector: 'span' })).not.toHaveLength(0)
    expect(screen.getAllByText('Search indexing failed. You can retry this document.')).not.toHaveLength(0)
    expect(screen.queryByText('EMBEDDING_PROVIDER_FAILED')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Retry' })).not.toHaveLength(0)
  })
})
