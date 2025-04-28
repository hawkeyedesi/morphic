import { z } from 'zod'

/**
 * Represents a file attachment metadata
 */
export interface FileAttachment {
  id: string
  originalName: string
  storagePath: string
  mimeType: string
  size: number
  uploadedAt: Date
  extractedText?: string
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
}

/**
 * Schema for file attachment metadata
 */
export const fileAttachmentSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  storagePath: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedAt: z.date(),
  extractedText: z.string().optional(),
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
  error: z.string().optional()
})

/**
 * Schema for the file context tool parameters
 */
export const fileContextSchema = z.object({
  fileId: z.string().describe('ID of the file to access'),
  page: z.number().optional().describe('Page number for paginated content'),
  query: z.string().optional().describe('Search query to filter content')
})

/**
 * Interface for processed file content with chunking
 */
export interface ProcessedFile {
  id: string
  structure?: DocumentStructure
  chunks: DocumentChunk[]
  vectors?: ChunkVector[]
}

/**
 * Interface for document structure
 */
export interface DocumentStructure {
  title?: string
  authors?: string[]
  abstract?: string
  sections: {
    heading: string
    level: number
    content: string
    startPosition: number
    endPosition: number
  }[]
  figures?: {
    caption: string
    position: number
  }[]
  tables?: {
    caption: string
    position: number
  }[]
  references?: string[]
}

/**
 * Interface for document chunk
 */
export interface DocumentChunk {
  id: string
  content: string
  metadata?: {
    sectionTitle?: string
    sectionLevel?: number
    documentId?: string
    position?: number
    relevanceScore?: number
  }
}

/**
 * Interface for chunk vector
 */
export interface ChunkVector {
  chunkId: string
  embedding: number[]
  metadata: {
    documentId: string
    sectionTitle?: string
    position?: number
  }
}

/**
 * Interface for file processor
 */
export interface FileProcessor {
  process(file: FileAttachment): Promise<ProcessedFile>
}