// Mirrors specs/001-project-foundation/api-contract.md (spec repository).
export type DocumentStatus = 'QUEUED' | 'PROCESSING' | 'INDEXED' | 'FAILED'

export interface ApiError {
  code: string
  message: string
  correlationId: string
}

export interface Me {
  subject: string
  role: 'ADMIN' | 'MEMBER' | 'NONE'
  readableCollectionIds: string[]
  manageableCollectionIds: string[]
}

export interface DocumentResponse {
  id: string
  collectionId: string
  fileName: string
  contentType: string
  sizeBytes: number
  status: DocumentStatus
  failureReason?: string | null
  version?: string | null
  documentType?: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface DocumentPage {
  items: DocumentResponse[]
  page: number
  size: number
  totalItems: number
}

export interface DocumentListQuery {
  collectionId?: string
  status?: DocumentStatus
  documentType?: string
  tag?: string
  page?: number
  size?: number
}

export interface UploadRequest {
  file: File
  collectionId: string
  version?: string
  documentType?: string
  tags?: string[]
}

export interface UploadAcceptedResponse {
  documentId: string
  status: DocumentStatus
  statusUrl: string
}

export interface ChatFilters {
  collectionIds?: string[]
  version?: string
  documentType?: string
  tags?: string[]
}

export interface ChatQueryRequest {
  question: string
  filters?: ChatFilters
}

export interface Citation {
  documentId: string
  fileName: string
  chunkId: string
  pageNumber?: number | null
  section?: string | null
  snippet: string
}

export interface ChatQueryResponse {
  answer: string | null
  insufficientEvidence: boolean
  citations: Citation[]
  correlationId: string
  timingMs: number
  retrievalMs: number
}
