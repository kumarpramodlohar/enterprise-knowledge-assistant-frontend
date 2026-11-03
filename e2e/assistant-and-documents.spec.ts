import { expect, test } from '@playwright/test'

test('signs in, uploads a document, and shows an insufficient-evidence answer', async ({
  page,
}) => {
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
    } else if (
      url.pathname === '/api/v1/documents' &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        json: {
          items: listed
            ? [
                {
                  id: 'doc-1',
                  collectionId: 'collection-1',
                  fileName: 'guide.txt',
                  contentType: 'text/plain',
                  sizeBytes: 7,
                  status: 'QUEUED',
                  tags: [],
                  createdAt: '2026-10-11T00:00:00Z',
                  updatedAt: '2026-10-11T00:00:00Z',
                },
              ]
            : [],
          page: 0,
          size: 100,
          totalItems: listed ? 1 : 0,
        },
      })
    } else if (
      url.pathname === '/api/v1/documents' &&
      request.method() === 'POST'
    ) {
      listed = true
      await route.fulfill({
        status: 202,
        json: {
          documentId: 'doc-1',
          status: 'QUEUED',
          statusUrl: '/api/v1/documents/doc-1',
        },
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
      await route.fulfill({
        status: 404,
        json: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
          correlationId: 'e2e',
        },
      })
    }
  })

  await page.goto('/')
  await page.getByLabel('Username').fill('manager')
  await page.getByLabel('Password').fill('local-only')
  await page.getByRole('button', { name: 'Sign in locally' }).click()
  await expect(
    page.locator('aside').getByText('Signed in as manager'),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Upload documents' }).click()
  await page
    .getByRole('form', { name: 'Upload document' })
    .getByRole('combobox')
    .selectOption('collection-1')
  await expect(
    page.getByRole('form', { name: 'Upload document' }),
  ).toBeVisible()
  await page
    .getByRole('form', { name: 'Upload document' })
    .getByLabel(/File/)
    .setInputFiles({
      name: 'guide.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('content'),
    })
  await page.getByRole('button', { name: 'Upload document' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Upload accepted (Queued)' }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'guide.txt' })
      .getByText('Queued', { exact: true }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Ask' }).click()
  await page
    .getByRole('textbox', { name: 'Question' })
    .fill('What does the guide say?')
  await page.getByRole('button', { name: 'Ask' }).click()
  await expect(
    page.getByRole('heading', { name: 'Insufficient evidence' }),
  ).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open navigation menu' }).click()
  await expect(
    page.getByRole('navigation', { name: 'Mobile primary' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Documents' }).click()
  await expect(
    page.getByRole('heading', { name: 'Documents', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open navigation menu' }),
  ).toHaveAttribute('aria-expanded', 'false')
})
