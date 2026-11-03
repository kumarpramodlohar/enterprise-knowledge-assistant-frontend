# Enterprise Knowledge Assistant - Frontend

This repository contains the React and TypeScript browser application for the Enterprise Knowledge Assistant (EKA). It provides a single-turn assistant, a document library, and sign-in flows. The UI calls a versioned Spring Boot API; the backend and its behavior are not part of this repository, so those calls are documented as frontend contracts rather than verified end-to-end integrations.

## Current Implementation Status

| Area                  | Status                                                                                                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sign-in               | Local HTTP Basic form and optional OIDC Authorization Code with PKCE are implemented. The frontend loads the current user from the API. Backend identity-provider configuration is not verified here.                    |
| Assistant             | Sends questions and filters to the chat API and displays answers, insufficient-evidence states, citations, and optional external citations. Responses are single-turn; there is no conversation history or streaming UI. |
| Documents             | Lists and filters documents, uploads files, displays ingestion status, and provides re-index/retry and delete actions for manageable collections. The UI requests up to 100 records; it has no page navigation.          |
| Backend connectivity  | API client methods and request/response types exist. Unit and browser tests mock responses; live backend compatibility and end-to-end behavior are unverified in this repository.                                        |
| Collection management | Not implemented. Collections are read from the current user's API response.                                                                                                                                              |

## Features

- Sign in with local HTTP Basic credentials in development, or use the configured company SSO button.
- Ask a question with optional collection, version, document-type, and tag filters.
- Opt in to external web search for an individual question.
- Review answer evidence and citation snippets. For internal citations, the app checks document access/status before showing the snippet; external links are opened only for HTTPS URLs.
- Browse documents by collection and ingestion status; upload PDF, DOCX, TXT, or Markdown files with optional metadata.
- Re-index or retry failed documents, delete documents, and inspect document metadata.
- Responsive layouts, loading/empty/error states, keyboard focus styles, and accessible status announcements are implemented in the UI.

Upload acceptance means the backend accepted a queued request; it does not mean indexing has completed. The file input advertises a 10 MB limit and accepted extensions, but the backend must enforce upload restrictions.

## Technology Stack

| Concern                      | Implementation                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| UI and language              | React 19, React DOM, TypeScript (strict mode)                                       |
| Build and development server | Vite 8                                                                              |
| Routing                      | React Router 7                                                                      |
| Styling                      | Tailwind CSS 4 through `@tailwindcss/vite`                                          |
| Authentication               | `oidc-client-ts`; local Basic authorization is assembled by the app                 |
| HTTP                         | Native `fetch` through the typed client in [`src/api/client.ts`](src/api/client.ts) |
| Unit/component tests         | Vitest, Testing Library, jsdom, and `vitest-axe`                                    |
| Browser tests                | Playwright                                                                          |
| Linting/formatting           | Oxlint and Prettier                                                                 |

Application state uses React hooks and an authentication context. There is no Redux, Zustand, React Query, or separate form/validation library.

## Application Architecture

[`src/main.tsx`](src/main.tsx) creates the React root and wraps the app in `AuthProvider` and `BrowserRouter`. [`src/app/AppRoutes.tsx`](src/app/AppRoutes.tsx) defines the pages; the authenticated [`src/components/Layout.tsx`](src/components/Layout.tsx) provides the navigation shell. Page components call the API client exposed through auth context. API types and safe error mapping live alongside the client.

The frontend reads the identity and collection permissions returned by `/api/v1/me` to shape the interface. The server remains authoritative for authentication, authorization, document access, and retrieval.

## Application Flow

1. The login page signs in locally or redirects to the configured OIDC provider. On successful sign-in, the app loads `/api/v1/me`.
2. The layout redirects users without an authenticated state to `/login`; successful sign-in opens `/assistant`.
3. The assistant submits one question to the chat endpoint. The response and citations are rendered as text; internal source snippets are shown only after a document access/status check.
4. The documents page loads the user's documents, optionally filters by collection/status, and refreshes queued/processing items periodically. An upload or management action is sent to the API and the list is refreshed.

## Repository Structure

```text
src/
  api/          Typed API client, request/response types, error handling, tests
  app/          Root app, routes, runtime configuration, tests
  auth/         Authentication context/provider and OIDC client
  components/   Shared layout and loading/empty/error views
  features/     Reserved feature folders (currently .gitkeep placeholders)
  pages/        Login, callback, assistant, documents, and not-found pages
  test/         Vitest setup
e2e/            Playwright browser tests and notes
public/         Static assets
Dockerfile      Multi-stage Vite build and Nginx static runtime
nginx.conf      SPA fallback routing
```

## Prerequisites

- Node.js `20.19+`, `22.12+`, or `24+` (the compatible ranges required by the configured Vite/Vitest toolchain). The Docker build stage uses Node 24.
- npm. The repository includes `package-lock.json`; use `npm ci` for a lockfile-based install. No separate npm version is declared.

## Environment Configuration

Vite exposes `VITE_` variables in the browser bundle. Use only non-secret values; never place passwords, client secrets, or private credentials in these variables.

| Variable              | Required                | Purpose and default                                                                                                                                         |
| --------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`   | No                      | API origin/base URL without a trailing slash. Empty (default) uses same-origin requests; during development Vite proxies `/api` to `http://localhost:8080`. |
| `VITE_OIDC_AUTHORITY` | Optional with client ID | OIDC issuer URL. Must be set together with `VITE_OIDC_CLIENT_ID`; if both are empty, OIDC is disabled.                                                      |
| `VITE_OIDC_CLIENT_ID` | Optional with authority | Public browser-client ID. Must be set together with `VITE_OIDC_AUTHORITY`.                                                                                  |
| `E2E_BASE_URL`        | No (browser tests only) | Playwright base URL; defaults to `http://localhost:5173`.                                                                                                   |

The checked-in [`.env.example`](.env.example) contains example local OIDC values. Copy it for local development and clear both OIDC values if no local identity provider is configured:

```dotenv
VITE_API_BASE_URL=
VITE_OIDC_AUTHORITY=http://127.0.0.1:8180/realms/eka
VITE_OIDC_CLIENT_ID=eka-frontend
```

`VITE_API_BASE_URL` and OIDC values are build-time configuration. In a production build, an empty API base means same-origin API requests. The included Nginx configuration only provides SPA fallback routing; it does not proxy `/api`. Set the API base to the backend origin or deploy behind a reverse proxy that routes API requests.

## Installation and Local Development

```bash
npm ci
cp .env.example .env
npm run dev
```

Vite prints the local URL when the server starts (normally `http://localhost:5173`). The development server proxies `/api` to `http://localhost:8080` when `VITE_API_BASE_URL` is empty. To use the API elsewhere, set `VITE_API_BASE_URL` in `.env` and restart Vite.

## Backend Integration

The API client adds the current `Authorization` header when available. It uses `fetch`, converts network and HTTP failures into `ApiRequestError`, and calls the auth provider's unauthorized callback on HTTP 401. UI errors use fixed, user-safe messages and can include a correlation ID. There is no general request timeout or automatic retry layer.

The frontend API paths and shapes below are implemented in [`src/api/client.ts`](src/api/client.ts) and [`src/api/types.ts`](src/api/types.ts). They have not been independently checked against the backend implementation.

| Method   | Path                             | Frontend operation                                                                                                                                                        |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/v1/me`                     | Sign-in verification and loading the subject, role, and readable/manageable collection IDs.                                                                               |
| `GET`    | `/api/v1/documents`              | List documents with optional `collectionId`, `status`, `documentType`, `tag`, `page`, and `size` query parameters. The page currently sends `page=0` and `size=100`.      |
| `GET`    | `/api/v1/documents/{id}`         | Check an internal citation's access/status before displaying its returned citation snippet.                                                                               |
| `POST`   | `/api/v1/documents`              | Multipart upload: `file`, `collectionId`, optional `version`, `documentType`, and repeated `tags`; expects an accepted response with document ID, status, and status URL. |
| `POST`   | `/api/v1/documents/{id}/reindex` | Re-index a document or retry a failed one.                                                                                                                                |
| `DELETE` | `/api/v1/documents/{id}`         | Delete a document.                                                                                                                                                        |
| `POST`   | `/api/v1/chat/query`             | JSON question, optional filters, and `allowExternalSearch`; expects answer, insufficient-evidence flag, citations, correlation ID, and timing fields.                     |

The typed contract includes fields for document status, citations, chat filters, and user permissions. It does not expose a frontend operation for collection creation, conversation history, or streaming responses.

Backend repository: [enterprise-knowledge-assistant-backend](https://github.com/kumarpramodlohar/enterprise-knowledge-assistant-backend).

## Main Pages and Components

| Route            | Page                                                 | Purpose                                                             |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `/login`         | [`LoginPage`](src/pages/LoginPage.tsx)               | Local development sign-in and optional company SSO.                 |
| `/auth/callback` | [`AuthCallbackPage`](src/pages/AuthCallbackPage.tsx) | Completes the OIDC redirect callback.                               |
| `/assistant`     | [`AssistantPage`](src/pages/AssistantPage.tsx)       | Single-turn question form, filters, answers, and sources.           |
| `/documents`     | [`DocumentsPage`](src/pages/DocumentsPage.tsx)       | Document list, upload, status, details, re-index/retry, and delete. |
| Other paths      | [`NotFoundPage`](src/pages/NotFoundPage.tsx)         | Not-found page inside the application layout.                       |

[`StateViews`](src/components/StateViews.tsx) contains shared loading, empty, and error states. The document page has responsive table/card layouts and native dialog elements for details and delete confirmation.

## State Management and Data Flow

[`AuthProvider`](src/auth/AuthProvider.tsx) owns the current authentication state and API client. Page-level state is managed with React `useState`, `useEffect`, `useMemo`, and `useCallback`; there is no global data-fetching/cache library. [`useApiQuery`](src/api/useApiQuery.ts) provides a small loading/success/error query helper. The documents page uses its own refresh and bounded status-polling logic.

## Authentication and Security

- Local development sign-in constructs an HTTP Basic header and keeps it in memory. The UI describes this option as development-only; the backend must decide whether to accept it.
- If both OIDC settings are present, the app uses the Authorization Code flow with PKCE. The OIDC client is public and has no client secret. Access tokens are kept in memory; transient redirect state is stored in `sessionStorage`.
- A successful login is confirmed by `/api/v1/me`. The app clears the local session on API 401 or when OIDC renewal ends.
- The layout redirects unauthenticated users, and management controls are shown only for collections listed as manageable. These are UI behaviors, not security controls; the backend must enforce authorization on every request.
- React renders server-provided answer/citation text as text rather than HTML. User-safe API messages are mapped in [`src/api/errors.ts`](src/api/errors.ts). External citation links are limited to HTTPS and use `noopener noreferrer`.

This README does not certify the application or backend as secure or production-ready. Review backend authorization, CORS, provider configuration, upload validation, and deployment settings independently.

## Testing and Code Quality

Unit and component tests are under `src/` and run in jsdom through Vitest. They use Testing Library and selected accessibility assertions with `vitest-axe`. The Playwright scenario stubs API responses and is intended to cover local sign-in, upload, and an insufficient-evidence answer; it does not verify a live backend. See [`e2e/README.md`](e2e/README.md).

```bash
npm test                 # Run unit and component tests
npm run test:watch       # Run Vitest in watch mode
npm run test:coverage    # Collect Vitest coverage
npm run test:e2e         # Run Playwright browser tests
npm run lint             # Run Oxlint
npm run typecheck        # Run TypeScript project checks
npm run format:check     # Check Prettier formatting
npm run build            # Type-check and create the production bundle
```

Playwright starts the Vite development server automatically. If the browser binary is not installed, install the Playwright Chromium browser with `npx playwright install chromium`.

## Production Build and Deployment

```bash
npm run build
npm run preview
```

The build output is written to `dist/`. The repository also includes a multi-stage [`Dockerfile`](Dockerfile): it builds with Node 24, then serves the static output with Nginx on port 80. The [`nginx.conf`](nginx.conf) falls back to `index.html` for SPA routes; it contains no API proxy configuration.

```bash
docker build -t eka-frontend .
docker run --rm -p 8080:80 eka-frontend
```

Pass `VITE_API_BASE_URL`, `VITE_OIDC_AUTHORITY`, and `VITE_OIDC_CLIENT_ID` as Docker build arguments when building an image that needs those values. They are embedded at build time, not read from the container at runtime. No CI/CD workflow or cloud deployment configuration is present in this repository.

## Troubleshooting

- **API requests fail locally:** Ensure the backend is listening at `http://localhost:8080`, or set `VITE_API_BASE_URL` to its origin. Restart Vite after changing `.env`.
- **SSO is unavailable or configuration fails:** Set both OIDC variables or clear both. Verify the provider's issuer and that its client allows the exact app callback URI `/auth/callback`.
- **A user can browse but not manage a collection:** The UI uses `manageableCollectionIds` from `/api/v1/me`; confirm the account's server-side grants.
- **Uploads appear queued or processing:** Acceptance is asynchronous. Use **Refresh status**; the page polls pending records for a limited period and then requires manual refresh.
- **Production requests return HTML instead of API data:** The included Nginx config only serves the SPA. Set the API origin at build time or configure an upstream reverse proxy for `/api`.
- **Playwright cannot launch a browser:** Run `npx playwright install chromium`.

## Known Limitations and Future Work

- No conversation history, streaming answers, or collection creation/management UI.
- Document list requests are limited to the first 100 results; no pagination controls are present.
- External web search is a per-question opt-in handled by the backend; the frontend does not implement the provider.
- Live backend behavior, API compatibility, and production identity-provider configuration cannot be verified from this repository.
- Feature directories under `src/features/` are currently placeholders, not implemented feature modules.

## Related Repositories

- [enterprise-knowledge-assistant-spec](https://github.com/kumarpramodlohar/enterprise-knowledge-assistant-spec) - product requirements, architecture decisions, and feature specifications.
- [enterprise-knowledge-assistant-backend](https://github.com/kumarpramodlohar/enterprise-knowledge-assistant-backend) - Spring Boot APIs and backend processing.

## Development Workflow and Contribution

Use the npm scripts above to run tests, lint, type-check, format-check, and build before submitting changes. The repository uses a package lockfile and Prettier configuration; it does not currently include a contribution guide or CI workflow. Refer to the specification repository for product requirements and architecture context, while treating the implementation in this repository as the source of truth for frontend behavior.

## License

No license has been specified in this repository.
