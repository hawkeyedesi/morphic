import 'server-only'

import { pipeline } from '@xenova/transformers'
import pdf from 'pdf-parse'
import mammoth from 'mammoth'
import fs from 'fs/promises'
import path from 'path'
import { Document, DocumentChunk, DocumentSearchResult } from '@/lib/types/document'
import { v4 as uuidv4 } from 'uuid'
import { analyzeImageWithOllama, checkOllamaAvailability } from './ollama-vision'

// Local storage paths
const BASE_UPLOAD_DIR = path.join(process.cwd(), 'uploads')

// Get chat-specific paths
function getChatPaths(chatId: string) {
  const chatDir = path.join(BASE_UPLOAD_DIR, 'chats', chatId)
  return {
    uploadDir: chatDir,
    chunksFile: path.join(chatDir, 'chunks.json'),
    metadataFile: path.join(chatDir, 'metadata.json')
  }
}

// Ensure directories exist
async function ensureDirectories(chatId: string) {
  const { uploadDir } = getChatPaths(chatId)
  await fs.mkdir(uploadDir, { recursive: true })
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

async function parseImage(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Check if Ollama is available
    const isAvailable = await checkOllamaAvailability()
    if (!isAvailable) {
      console.warn('Ollama Vision model not available. To enable image analysis:')
      console.warn('1. Install Ollama: https://ollama.ai')
      console.warn('2. Run: ollama pull gemma3:4b')
      console.warn('3. Ensure Ollama is running: ollama serve')
      
      // Return a placeholder for now
      return 'Image uploaded. Vision analysis not available. Please install Ollama and gemma3:4b model for image content analysis.'
    }
    
    // Analyze image with Ollama Vision
    const { description, extractedText } = await analyzeImageWithOllama(buffer, mimeType)
    
    // Combine description and extracted text into searchable content
    let content = `Image Description:\n${description}\n\n`
    
    if (extractedText && extractedText !== 'No text found') {
      content += `Extracted Text:\n${extractedText}`
    }
    
    return content
  } catch (error) {
    console.error('Image parsing error:', error)
    // Return a basic placeholder instead of throwing
    return 'Image uploaded. Error during vision analysis: ' + (error as Error).message
  }
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

// Calculate cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
  }
  return dotProduct
}

interface StoredChunk extends DocumentChunk {
  embedding: number[]
}

export class SimpleDocumentService {
  // Store chunks per chat
  private chunksByChat: Map<string, StoredChunk[]> = new Map()
  private initializedChats: Set<string> = new Set()

  async initialize(chatId: string) {
    if (this.initializedChats.has(chatId)) return
    
    await ensureDirectories(chatId)
    const { chunksFile } = getChatPaths(chatId)
    
    // Load existing chunks for this chat
    try {
      const data = await fs.readFile(chunksFile, 'utf-8')
      this.chunksByChat.set(chatId, JSON.parse(data))
    } catch (e) {
      // File doesn't exist yet
      this.chunksByChat.set(chatId, [])
    }
    
    this.initializedChats.add(chatId)
  }

  private async saveChunks(chatId: string) {
    const chunks = this.chunksByChat.get(chatId) || []
    const { chunksFile } = getChatPaths(chatId)
    await fs.writeFile(chunksFile, JSON.stringify(chunks, null, 2))
  }

  async uploadDocument(
    file: File,
    userId: string | null,
    chatId: string
  ): Promise<Document> {
    await this.initialize(chatId)
    
    const documentId = uuidv4()
    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Save file to local storage
    const filename = `${documentId}_${file.name}`
    const { uploadDir } = getChatPaths(chatId)
    const filepath = path.join(uploadDir, filename)
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
      case 'png':
      case 'jpg':
      case 'jpeg':
        content = await parseImage(buffer, file.type)
        break
      default:
        content = await parseText(buffer)
    }
    
    // Create chunks
    const textChunks = chunkText(content)
    
    // Generate embeddings and store chunks
    const chunks = this.chunksByChat.get(chatId) || []
    for (let i = 0; i < textChunks.length; i++) {
      const embedding = await generateEmbedding(textChunks[i])
      chunks.push({
        id: uuidv4(),
        document_id: documentId,
        content: textChunks[i],
        chunk_index: i,
        embedding: embedding,
        metadata: {
          page_number: Math.floor(i / 3) + 1,
          section: file.name
        },
        created_at: new Date().toISOString()
      })
    }
    this.chunksByChat.set(chatId, chunks)
    
    // Save chunks to disk
    await this.saveChunks(chatId)
    
    // Create document record
    const doc: Document = {
      id: documentId,
      user_id: userId,
      filename: file.name,
      content: content.substring(0, 1000) + '...', // Store preview
      file_type: fileType,
      file_size: file.size,
      chunk_count: textChunks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    // Store document metadata
    const { metadataFile } = getChatPaths(chatId)
    let metadata: Record<string, Document> = {}
    try {
      const existing = await fs.readFile(metadataFile, 'utf-8')
      metadata = JSON.parse(existing)
    } catch (e) {
      // File doesn't exist yet
    }
    metadata[documentId] = doc
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2))
    
    return doc
  }

  async searchDocuments(
    query: string,
    chatId: string,
    limit: number = 5
  ): Promise<DocumentSearchResult[]> {
    await this.initialize(chatId)
    
    const chunks = this.chunksByChat.get(chatId) || []
    if (chunks.length === 0) {
      return []
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query)
    
    // Calculate similarities
    const results = chunks
      .map(chunk => ({
        chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
    
    // Get document names
    const { metadataFile } = getChatPaths(chatId)
    let metadata: Record<string, Document> = {}
    try {
      const data = await fs.readFile(metadataFile, 'utf-8')
      metadata = JSON.parse(data)
    } catch (e) {
      // Use fallback
    }
    
    return results.map(({ chunk, similarity }) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      document_name: metadata[chunk.document_id]?.filename || 'Unknown Document',
      content: chunk.content,
      similarity,
      metadata: chunk.metadata
    }))
  }

  async getDocuments(userId: string | null, chatId: string): Promise<Document[]> {
    await this.initialize(chatId)
    const { metadataFile } = getChatPaths(chatId)
    try {
      const data = await fs.readFile(metadataFile, 'utf-8')
      const metadata: Record<string, Document> = JSON.parse(data)
      
      // Filter by user if needed
      return Object.values(metadata).filter(doc => 
        userId ? doc.user_id === userId : true
      )
    } catch (e) {
      return []
    }
  }

  async deleteDocument(documentId: string, chatId: string): Promise<void> {
    await this.initialize(chatId)
    
    // Remove chunks from memory
    const chunks = this.chunksByChat.get(chatId) || []
    const filteredChunks = chunks.filter(chunk => chunk.document_id !== documentId)
    this.chunksByChat.set(chatId, filteredChunks)
    await this.saveChunks(chatId)
    
    // Delete metadata
    const { metadataFile, uploadDir } = getChatPaths(chatId)
    try {
      const data = await fs.readFile(metadataFile, 'utf-8')
      const metadata: Record<string, Document> = JSON.parse(data)
      delete metadata[documentId]
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2))
    } catch (e) {
      // Ignore if file doesn't exist
    }
    
    // Delete physical file
    const files = await fs.readdir(uploadDir)
    const fileToDelete = files.find(f => f.startsWith(documentId))
    if (fileToDelete) {
      await fs.unlink(path.join(uploadDir, fileToDelete))
    }
  }
}

// Singleton instance
let documentServiceInstance: SimpleDocumentService | null = null

export const getDocumentService = async () => {
  if (!documentServiceInstance) {
    documentServiceInstance = new SimpleDocumentService()
  }
  return documentServiceInstance
}