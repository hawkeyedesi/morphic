import { ProcessingConfig, ChunkingStrategy } from '@/lib/types/processing-config'
import { pipeline } from '@xenova/transformers'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
const pdfParse = require('pdf-parse')

interface StoredDocument {
  id: string
  user_id: string
  chat_id: string
  filename: string
  file_type: string
  file_size: number
  chunk_count: number
  created_at: string
  chunks: Array<{
    content: string
    embedding: number[]
    metadata: {
      page_number?: number
      chunk_index: number
    }
  }>
}

export class AdvancedDocumentService {
  private config: ProcessingConfig
  private embedModel: any
  
  constructor(config?: ProcessingConfig) {
    this.config = config || { mode: 'local', chunkingStrategy: 'auto' }
  }
  
  private async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.config.mode === 'cloud' && this.config.provider === 'openrouter') {
      // Use OpenRouter API for embeddings
      const apiKey = this.config.apiKey || process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OpenRouter API key not found')
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.OPENROUTER_APP_BASE || 'http://localhost:3000',
          'X-Title': 'Morphic Document Processing',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: texts
        })
      })
      
      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`)
      }
      
      const data = await response.json()
      return data.data.map((item: any) => item.embedding)
    } else {
      // Use local Xenova embeddings
      if (!this.embedModel) {
        this.embedModel = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        )
      }
      
      const embeddings: number[][] = []
      for (const text of texts) {
        const output = await this.embedModel(text, { pooling: 'mean', normalize: true })
        embeddings.push(Array.from(output.data) as number[])
      }
      return embeddings
    }
  }
  
  private splitText(content: string, strategy: ChunkingStrategy): string[] {
    const maxChunkSize = 1000
    const overlap = 200
    
    // Auto-detect strategy if not specified
    if (!strategy || strategy === 'auto') {
      if (content.includes('```') || content.includes('function ') || content.includes('class ')) {
        strategy = 'code'
      } else if (content.includes('# ') || content.includes('## ')) {
        strategy = 'markdown'
      } else {
        strategy = 'semantic'
      }
    }
    
    switch (strategy) {
      case 'markdown':
        return this.splitMarkdown(content, maxChunkSize, overlap)
        
      case 'code':
        return this.splitCode(content, maxChunkSize / 2, overlap / 2)
        
      case 'semantic':
        return this.splitSemantic(content, maxChunkSize, overlap)
        
      case 'fixed':
      default:
        return this.splitFixed(content, maxChunkSize, overlap)
    }
  }
  
  private splitMarkdown(content: string, maxSize: number, overlap: number): string[] {
    // Split by headers first
    const sections = content.split(/\n(?=#{1,6} )/g)
    const chunks: string[] = []
    
    for (const section of sections) {
      if (section.length <= maxSize) {
        chunks.push(section.trim())
      } else {
        // If section is too large, split by paragraphs
        const paragraphs = section.split(/\n\n+/)
        let currentChunk = ''
        
        for (const paragraph of paragraphs) {
          if (currentChunk.length + paragraph.length > maxSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim())
            // Add overlap from the end of the previous chunk
            currentChunk = currentChunk.slice(-overlap) + '\n\n' + paragraph
          } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
      }
    }
    
    return chunks.filter(chunk => chunk.length > 0)
  }
  
  private splitCode(content: string, maxSize: number, overlap: number): string[] {
    // Split by functions/classes first
    const codeBlocks = content.split(/\n(?=(?:function|class|const|let|var|export|import)\s)/g)
    const chunks: string[] = []
    
    for (const block of codeBlocks) {
      if (block.length <= maxSize) {
        chunks.push(block.trim())
      } else {
        // If block is too large, split by lines preserving indentation
        const lines = block.split('\n')
        let currentChunk = ''
        
        for (const line of lines) {
          if (currentChunk.length + line.length > maxSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim())
            // Keep some context
            const lastLines = currentChunk.split('\n').slice(-3).join('\n')
            currentChunk = lastLines + '\n' + line
          } else {
            currentChunk += (currentChunk ? '\n' : '') + line
          }
        }
        
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
      }
    }
    
    return chunks.filter(chunk => chunk.length > 0)
  }
  
  private splitSemantic(content: string, maxSize: number, overlap: number): string[] {
    // Split by sentences, trying to keep paragraphs together
    const paragraphs = content.split(/\n\n+/)
    const chunks: string[] = []
    let currentChunk = ''
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed max size
      if (currentChunk.length + paragraph.length > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        // Start new chunk with overlap
        const sentences = currentChunk.split(/[.!?]+\s+/)
        const overlapSentences = sentences.slice(-2).join('. ')
        currentChunk = overlapSentences + (overlapSentences ? '. ' : '') + paragraph
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks.filter(chunk => chunk.length > 0)
  }
  
  private splitFixed(content: string, maxSize: number, overlap: number): string[] {
    const chunks: string[] = []
    let start = 0
    
    while (start < content.length) {
      const end = Math.min(start + maxSize, content.length)
      chunks.push(content.slice(start, end))
      start = end - overlap
    }
    
    return chunks
  }
  
  async uploadDocument(file: File, userId: string, chatId: string) {
    const documentId = uuidv4()
    const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt'
    
    // Parse document content
    let content = ''
    
    try {
      if (fileType === 'pdf') {
        const buffer = Buffer.from(await file.arrayBuffer())
        const data = await pdfParse(buffer)
        content = data.text
      } else if (['txt', 'md'].includes(fileType)) {
        content = await file.text()
      } else if (['png', 'jpg', 'jpeg'].includes(fileType)) {
        // For images, we'll store the base64 and process with Ollama if needed
        const buffer = Buffer.from(await file.arrayBuffer())
        content = `[Image: ${file.name}]\nBase64: ${buffer.toString('base64').substring(0, 100)}...`
      } else {
        // For other types, try to read as text
        content = await file.text()
      }
    } catch (error) {
      console.error('Error parsing document:', error)
      throw new Error('Failed to parse document content')
    }
    
    // Split content into chunks
    const chunks = this.splitText(content, this.config.chunkingStrategy || 'auto')
    
    // Generate embeddings
    const embeddings = await this.getEmbeddings(chunks)
    
    // Create document object
    const document: StoredDocument = {
      id: documentId,
      user_id: userId,
      chat_id: chatId,
      filename: file.name,
      file_type: fileType,
      file_size: file.size,
      chunk_count: chunks.length,
      created_at: new Date().toISOString(),
      chunks: chunks.map((chunk, i) => ({
        content: chunk,
        embedding: embeddings[i],
        metadata: {
          chunk_index: i
        }
      }))
    }
    
    // Save to file system
    const storagePath = join(process.cwd(), 'uploads', 'chats', chatId)
    await fs.mkdir(storagePath, { recursive: true })
    
    const docPath = join(storagePath, `${documentId}.json`)
    await fs.writeFile(docPath, JSON.stringify(document, null, 2))
    
    return {
      id: document.id,
      filename: document.filename,
      file_size: document.file_size,
      chunk_count: document.chunk_count,
      created_at: document.created_at
    }
  }
  
  async searchDocuments(query: string, chatId: string, limit = 5) {
    const queryEmbedding = (await this.getEmbeddings([query]))[0]
    
    // Load all documents for this chat
    const storagePath = join(process.cwd(), 'uploads', 'chats', chatId)
    let allResults: any[] = []
    
    try {
      const files = await fs.readdir(storagePath)
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        
        const docPath = join(storagePath, file)
        const doc: StoredDocument = JSON.parse(await fs.readFile(docPath, 'utf-8'))
        
        // Calculate similarity for each chunk
        for (const chunk of doc.chunks) {
          const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding)
          
          allResults.push({
            document_id: doc.id,
            document_name: doc.filename,
            content: chunk.content,
            similarity,
            metadata: chunk.metadata
          })
        }
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return []
      }
      throw error
    }
    
    // Sort by similarity and return top results
    return allResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }
  
  async getDocuments(userId: string, chatId: string) {
    const storagePath = join(process.cwd(), 'uploads', 'chats', chatId)
    
    try {
      const files = await fs.readdir(storagePath)
      const documents = []
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        
        const docPath = join(storagePath, file)
        const doc: StoredDocument = JSON.parse(await fs.readFile(docPath, 'utf-8'))
        
        documents.push({
          id: doc.id,
          filename: doc.filename,
          file_size: doc.file_size,
          chunk_count: doc.chunk_count,
          created_at: doc.created_at
        })
      }
      
      return documents
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return []
      }
      throw error
    }
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitudeA * magnitudeB)
  }
}

export async function getAdvancedDocumentService(config?: ProcessingConfig) {
  return new AdvancedDocumentService(config)
}