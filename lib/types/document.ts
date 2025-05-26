export interface Document {
  id: string
  user_id: string | null
  filename: string
  content: string
  file_type: string
  file_size: number
  chunk_count: number
  created_at: string
  updated_at: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  content: string
  chunk_index: number
  embedding: number[] | null
  metadata: {
    page_number?: number
    section?: string
  }
  created_at: string
}

export interface DocumentSearchResult {
  chunk_id: string
  document_id: string
  document_name: string
  content: string
  similarity: number
  metadata: {
    page_number?: number
    section?: string
  }
}