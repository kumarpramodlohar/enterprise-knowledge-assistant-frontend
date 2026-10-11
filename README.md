# Enterprise Knowledge Assistant

Enterprise Knowledge Assistant (EKA) helps people find answers in technical documents they are allowed to access. Users ask questions in natural language and receive answers grounded in retrieved passages, with citations they can inspect. When the available sources do not support an answer, the product should say so instead of guessing.

This repository contains the **React and TypeScript web client** for EKA. It is one part of a larger application: the target system pairs this UI with a Spring Boot API, PostgreSQL with pgvector, and configured language-model and embedding providers. The product and architecture documents describe the intended MVP; they are not a claim that every feature is already implemented.

## Product Workflows

- **Ask and verify:** Submit a question, narrow it to an authorized collection or metadata scope, review an evidence-based answer, and open its citations.
- **Manage knowledge:** Upload supported documents, follow their processing status, and manage indexed documents where permitted.
- **Protect sensitive information:** The backend enforces identity and document permissions during upload, retrieval, and citation access. The UI is not a security boundary.

The MVP is designed around trustworthy answers: source references must resolve to real, accessible documents, retrieved text is treated as untrusted input, and insufficient evidence must not be presented as fact. Conversation history, answer feedback, hybrid retrieval, reranking, and Kafka-based ingestion are deferred from the MVP.

## Current Status

The frontend includes the typed API/auth foundation, document upload and lifecycle screens, and the single-turn assistant with citations. See the canonical task list for verification status and known limitations.

## Run Locally

Prerequisites: Node.js and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Vite starts the frontend and prints its local URL. Set `VITE_API_BASE_URL` in `.env` to the Spring Boot API URL; the example value is `http://localhost:8080`. Do not put secrets in frontend environment variables because values prefixed with `VITE_` are exposed to the browser.

For local development, the sign-in form uses the backend's local HTTP Basic profile and keeps credentials in memory only. The Documents page exposes upload, re-index, and delete actions only for collections listed as manageable by `/api/v1/me`; server-side checks remain authoritative. Upload acceptance means queued, not indexed—use **Refresh status** to check progress. The Assistant page supports single-turn questions and authorized collection narrowing. Conversation history is not saved.

For the required backend, PostgreSQL/pgvector, Ollama, SQL seed, and environment setup, follow the backend repository README.

## Useful Commands

| Command             | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | Start the Vite development server.        |
| `npm run build`     | Type-check and create a production build. |
| `npm run typecheck` | Run the TypeScript project checks.        |
| `npm run lint`      | Run oxlint.                               |
| `npm test`          | Run the Vitest unit and component tests.  |
| `npm run test:e2e`  | Run the Playwright end-to-end tests.      |
| `npm run format`    | Format files with Prettier.               |

## Repository Layout

```text
src/app          Application routes and configuration
src/api          API client and API types
src/auth         Authentication integration
src/components   Shared UI and layout
src/pages        Assistant, documents, and not-found pages
src/features     Assistant and document feature areas
src/test         Test setup
e2e              Playwright end-to-end tests
docs             Product, requirements, feature, architecture, and implementation docs
```

## Project Documentation

- [Product overview and MVP scope](docs/Enterprise_Knowledge_Assistant_PRD_v1.md)
- [Canonical requirements and acceptance criteria](docs/Enterprise_Knowledge_Assistant_Requirements_v1.md)
- [Feature behavior and test scenarios](docs/Enterprise_Knowledge_Assistant_Feature_Specifications_v1.md)
- [Target system architecture](docs/Enterprise_Knowledge_Assistant_Architecture_v1.md)
- [Implementation backlog](docs/implementation/Implementation_Backlog_v1.md)
- [Approved product decisions](docs/implementation/product-decisions.md)
