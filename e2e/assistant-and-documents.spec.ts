import { expect, test } from '@playwright/test'

test('signs in, uploads a document, and shows an insufficient-evidence answer', async ({ page }) => {
  let listed = false
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/v1/me') {
      await route.fulfill({
        json: {
          subject: 'manager',
          role: 'MEMBER',
          readableCollectionIds: ['collection-1'],
          manageableCollectionIds: ['collection-1'],
        },
      })
    } else if (url.pathname === '/api/v1/documents' && request.method() === 'GET') {
      await route.fulfill({
        json: {
          items: listed ? [{
            id: 'doc-1',
            collectionId: 'collection-1',
            fileName: 'guide.txt',
            contentType: 'text/plain',
            sizeBytes: 7,
            status: 'QUEUED',
            tags: [],
            createdAt: '2026-10-11T00:00:00Z',
            updatedAt: '2026-10-11T00:00:00Z',
          }] : [],
          page: 0,
          size: 100,
          totalItems: listed ? 1 : 0,
        },
      })
    } else if (url.pathname === '/api/v1/documents' && request.method() === 'POST') {
      listed = true
      await route.fulfill({
        status: 202,
        json: { documentId: 'doc-1', status: 'QUEUED', statusUrl: '/api/v1/documents/doc-1' },
      })
    } else if (url.pathname === '/api/v1/chat/query') {
      await route.fulfill({
        json: {
          answer: null,
          insufficientEvidence: true,
          citations: [],
          correlationId: 'e2e-request',
          timingMs: 4,
          retrievalMs: 1,
        },
      })
    } else {
      await route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'Resource not found', correlationId: 'e2e' } })
    }
  })

  await page.goto('/')
  await page.getByLabel('Username').fill('manager')
  await page.getByLabel('Password').fill('local-only')
  await page.getByRole('button', { name: 'Sign in (local)' }).click()
  await expect(page.getByText('Signed in as manager')).toBeVisible()

  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByLabel('Upload collection').selectOption('collection-1')
  await expect(page.getByRole('form', { name: 'Upload document' })).toBeVisible()
  await page.getByLabel('File').setInputFiles({
    name: 'guide.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('content'),
  })
  await page.getByRole('button', { name: 'Upload' }).click()
  await expect(page.getByRole('status')).toContainText('Upload accepted (QUEUED)')
  await expect(page.getByText('Status: QUEUED')).toBeVisible()

  await page.getByRole('link', { name: 'Assistant' }).click()
  await page.getByLabel('Question').fill('What does the guide say?')
  await page.getByRole('button', { name: 'Ask' }).click()
  await expect(page.getByRole('heading', { name: 'Insufficient evidence' })).toBeVisible()
})
