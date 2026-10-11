import { ApiRequestError } from './client'

export type UiErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'duplicate'
  | 'file_too_large'
  | 'unsupported_type'
  | 'unprocessable'
  | 'provider'
  | 'network'
  | 'service'

export interface UiError {
  kind: UiErrorKind
  /** Fixed, user-safe text; server messages and payloads are never rendered. */
  message: string
  /** Lets a user quote the failing request to support. */
  correlationId?: string
}

const MESSAGES: Record<UiErrorKind, string> = {
  validation: 'The request was not valid. Check the values and try again.',
  unauthenticated: 'Your session is missing or has expired. Sign in again.',
  forbidden: 'You are not allowed to do that.',
  not_found: 'That item was not found or you do not have access to it.',
  duplicate: 'This document already exists in the collection.',
  file_too_large: 'The file is too large.',
  unsupported_type: 'Only PDF, DOCX, TXT and Markdown files are supported.',
  unprocessable: 'The file is corrupt or protected and cannot be read.',
  provider: 'The AI service is unavailable right now. Try again shortly.',
  network: 'Could not reach the service. Check your connection.',
  service: 'Something went wrong on our side. Try again later.',
}

const BY_CODE: Record<string, UiErrorKind> = {
  VALIDATION_FAILED: 'validation',
  REQUEST_REJECTED: 'validation',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  DUPLICATE_DOCUMENT: 'duplicate',
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_TYPE: 'unsupported_type',
  UNPROCESSABLE_DOCUMENT: 'unprocessable',
  PROVIDER_UNAVAILABLE: 'provider',
  NETWORK_ERROR: 'network',
  CHAT_PROVIDER_FAILED: 'provider',
  CHAT_PROVIDER_TIMEOUT: 'provider',
  EMBEDDING_PROVIDER_FAILED: 'provider',
  EMBEDDING_TIMEOUT: 'provider',
}

function kindFromStatus(status: number): UiErrorKind {
  switch (status) {
    case 0:
      return 'network'
    case 400:
      return 'validation'
    case 401:
      return 'unauthenticated'
    case 403:
      return 'forbidden'
    case 404:
      return 'not_found'
    case 409:
      return 'duplicate'
    case 413:
      return 'file_too_large'
    case 415:
      return 'unsupported_type'
    case 422:
      return 'unprocessable'
    case 502:
    case 503:
    case 504:
      return 'provider'
    default:
      return 'service'
  }
}

/** Maps any thrown value to a distinct, safe UI state. */
export function toUiError(error: unknown): UiError {
  if (error instanceof ApiRequestError) {
    const kind = BY_CODE[error.error.code] ?? kindFromStatus(error.status)
    return {
      kind,
      message: MESSAGES[kind],
      correlationId: error.error.correlationId || undefined,
    }
  }
  return { kind: 'service', message: MESSAGES.service }
}
