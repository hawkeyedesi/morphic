import 'server-only'

import { connect, Table } from 'vectordb'
import { pipeline } from '@xenova/transformers'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import fs from 'fs/promises'
import path from 'path'
import { Document, DocumentChunk, DocumentSearchResult } from '@/lib/types/document'
import { v4 as uuidv4 } from 'uuid'

// Local storage paths
const UPLOAD_DIR = path.join(process.cwd(), 'uploads')
const VECTOR_DB_PATH = path.join(process.cwd(), 'data', 'vector-db')

// Ensure directories exist
async function ensureDirectories() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  await fs.mkdir(VECTOR_DB_PATH, { recursive: true })
}

// Initialize embedding model (runs locally)
let embedder: any = null
async function getEmbedder() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
  }
  return embedder
}

// Document parsing functions
async function parsePDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer)
  return data.text
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

async function parseText(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8')
}

// Chunk text into smaller pieces
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = []
  let start = 0
  
  while (start < text.length) {
    const end = start + chunkSize
    chunks.push(text.slice(start, end))
    start = end - overlap
  }
  
  return chunks
}

// Generate embeddings locally
async function generateEmbedding(text: string): Promise<number[]> {
  const embedder = await getEmbedder()
  const output = await embedder(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data)
}

export class DocumentService {
  private db: any
  private table: Table | null = null

  async initialize() {
    try {
      await ensureDirectories()
      this.db = await connect(VECTOR_DB_PATH)
      
      // Create or open the documents table
      const tableNames = await this.db.tableNames()
      if (!tableNames.includes('documents')) {
        // Create initial empty data with proper types
        const initialData = [{
          chunk_id: uuidv4(),
          document_id: 'init',
          document_name: 'init',
          content: 'init',
          chunk_index: 0,
          vector: new Array(384).fill(0),
          page_number: 0,
          created_at: new Date().toISOString()
        }]
        
        this.table = await this.db.createTable('documents', initialData)
        
        // Delete the initialization record
        await this.table.delete(`chunk_id = "${initialData[0].chunk_id}"`)
      } else {
        this.table = await this.db.openTable('documents')
      }
    } catch (error) {
      console.error('Failed to initialize document service:', error)
      // Try to recover by deleting corrupted data
      try {
        await fs.rm(VECTOR_DB_PATH, { recursive: true, force: true })
        await this.initialize() // Retry
      } catch (retryError) {
        console.error('Failed to recover:', retryError)
        throw error
      }
    }
  }

  async uploadDocument(
    file: File,
    userId: string | null
  ): Promise<Document> {
    const documentId = uuidv4()
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Save file to local storage
    const filename = `${documentId}_${file.name}`
    const filepath = path.join(UPLOAD_DIR, filename)
    await fs.writeFile(filepath, buffer)
    
    // Parse document based on type
    let content: string
    const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt'
    
    switch (fileType) {
      case 'pdf':
        content = await parsePDF(buffer)
        break
      case 'docx':
      case 'doc':
        content = await parseDOCX(buffer)
        break
      default:
        content = await parseText(buffer)
    }
    
    // Create chunks
    const chunks = chunkText(content)
    
    // Generate embeddings and store in vector DB
    const records = []
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i])
      records.push({
        chunk_id: uuidv4(),
        document_id: documentId,
        document_name: file.name,
        content: chunks[i],
        chunk_index: i,
        vector: embedding,
        page_number: Math.floor(i / 3) + 1, // Rough estimate
        created_at: new Date().toISOString()
      })
    }
    
    await this.table!.add(records)
    
    // Create document record
    const doc: Document = {
      id: documentId,
      user_id: userId,
      filename: file.name,
      content: content.substring(0, 1000) + '...', // Store preview
      file_type: fileType,
      file_size: file.size,
      chunk_count: chunks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Store document metadata in a JSON file (simple approach for MVP)
    const metadataPath = path.join(UPLOAD_DIR, 'metadata.json')
    let metadata: Record<string, Document> = {}
    try {
      const existing = await fs.readFile(metadataPath, 'utf-8')
      metadata = JSON.parse(existing)
    } catch (e) {
      // File doesn't exist yet
    }
    metadata[documentId] = doc
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    
    return doc
  }

  async searchDocuments(
    query: string,
    limit: number = 5
  ): Promise<DocumentSearchResult[]> {
    if (!this.table) {
      return []
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)
    
    // Search in vector DB
    const results = await this.table
      .vectorSearch(queryEmbedding)
      .select(['chunk_id', 'document_id', 'document_name', 'content', 'page_number'])
      .limit(limit)
      .toArray()
    
    return results.map((r: any) => ({
      chunk_id: r.chunk_id,
      document_id: r.document_id,
      document_name: r.document_name,
      content: r.content,
      similarity: r._distance ? 1 - r._distance : 0,
      metadata: {
        page_number: r.page_number
      }
    }))
  }

  async getDocuments(userId: string | null): Promise<Document[]> {
    const metadataPath = path.join(UPLOAD_DIR, 'metadata.json')
    try {
      const data = await fs.readFile(metadataPath, 'utf-8')
      const metadata: Record<string, Document> = JSON.parse(data)
      
      // Filter by user if needed
      return Object.values(metadata).filter(doc => 
        userId ? doc.user_id === userId : true
      )
    } catch (e) {
      return []
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    // Delete from vector DB
    if (this.table) {
      await this.table.delete(`document_id = "${documentId}"`)
    }
    
    // Delete metadata
    const metadataPath = path.join(UPLOAD_DIR, 'metadata.json')
    try {
      const data = await fs.readFile(metadataPath, 'utf-8')
      const metadata: Record<string, Document> = JSON.parse(data)
      delete metadata[documentId]
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    } catch (e) {
      // Ignore if file doesn't exist
    }
    
    // Delete physical file
    const files = await fs.readdir(UPLOAD_DIR)
    const fileToDelete = files.find(f => f.startsWith(documentId))
    if (fileToDelete) {
      await fs.unlink(path.join(UPLOAD_DIR, fileToDelete))
    }
  }
}

// Singleton instance
let documentServiceInstance: DocumentService | null = null

export const getDocumentService = async () => {
  if (!documentServiceInstance) {
    documentServiceInstance = new DocumentService()
    await documentServiceInstance.initialize()
  }
  return documentServiceInstance
}