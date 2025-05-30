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
    console.log('🚀 AdvancedDocumentService initialized:', {
      mode: this.config.mode,
      provider: this.config.provider,
      chunkingStrategy: this.config.chunkingStrategy
    })
  }
  
  private async getEmbeddings(texts: string[]): Promise<number[][]> {
    if (this.config.mode === 'cloud') {
      console.log('☁️  Using cloud embeddings (OpenAI)')
      
      // Use OpenAI API for embeddings
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        console.warn('⚠️  OpenAI API key not found, falling back to local embeddings')
        return this.getLocalEmbeddings(texts)
      }
      
      try {
        console.log('🔑 Using OpenAI text-embedding-3-small model')
        
        // OpenAI has a limit of 8191 tokens per request, so we batch if needed
        const batchSize = 50 // Conservative batch size
        const allEmbeddings: number[][] = []
        
        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize)
          console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`)
          
          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'text-embedding-3-small',
              input: batch
            })
          })
          
          if (!response.ok) {
            const error = await response.text()
            console.error('❌ OpenAI API error:', error)
            console.log('⚠️  Falling back to local embeddings')
            return this.getLocalEmbeddings(texts)
          }
          
          const data = await response.json()
          const batchEmbeddings = data.data.map((item: any) => item.embedding)
          allEmbeddings.push(...batchEmbeddings)
          
          // Add a small delay between batches to avoid rate limits
          if (i + batchSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }
        }
        
        console.log('✅ Cloud embeddings generated for', texts.length, 'chunks (1536 dimensions)')
        return allEmbeddings
      } catch (error) {
        console.error('❌ Error calling OpenAI API:', error)
        console.log('⚠️  Falling back to local embeddings')
        return this.getLocalEmbeddings(texts)
      }
    } else {
      return this.getLocalEmbeddings(texts)
    }
  }
  
  private async getLocalEmbeddings(texts: string[]): Promise<number[][]> {
    console.log('🏠 Using local embeddings (Xenova/all-MiniLM-L6-v2)')
    // Use local Xenova embeddings
    if (!this.embedModel) {
      console.log('⏳ Loading local embedding model...')
      this.embedModel = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2'
      )
      console.log('✅ Local embedding model loaded')
    }
    
    const embeddings: number[][] = []
    for (const text of texts) {
      const output = await this.embedModel(text, { pooling: 'mean', normalize: true })
      embeddings.push(Array.from(output.data) as number[])
    }
    console.log('✅ Local embeddings generated for', texts.length, 'chunks (384 dimensions)')
    return embeddings
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
    console.log('📄 Starting document upload:', {
      filename: file.name,
      size: file.size,
      type: file.type,
      userId,
      chatId
    })
    
    const documentId = uuidv4()
    const fileType = file.name.split('.').pop()?.toLowerCase() || 'txt'
    
    // Parse document content
    let content = ''
    
    try {
      if (fileType === 'pdf') {
        console.log('📖 Parsing PDF document...')
        const buffer = Buffer.from(await file.arrayBuffer())
        const data = await pdfParse(buffer)
        content = data.text
        console.log('✅ PDF parsed, text length:', content.length)
      } else if (['txt', 'md'].includes(fileType)) {
        console.log('📝 Reading text/markdown file...')
        content = await file.text()
        console.log('✅ Text read, length:', content.length)
      } else if (['docx', 'doc'].includes(fileType)) {
        console.log('📄 Reading DOCX file...')
        content = await file.text()
        console.log('✅ DOCX read, length:', content.length)
      } else if (['png', 'jpg', 'jpeg'].includes(fileType)) {
        console.log('🖼️  Processing image file...')
        // For now, we'll create a placeholder. In production, you'd use OCR
        content = `[Image Document: ${file.name}]\n\nThis is an image file. To extract text from images, please use an OCR service or upload a text-based document instead.\n\nFile details:\n- Name: ${file.name}\n- Size: ${(file.size / 1024).toFixed(1)} KB\n- Type: ${fileType.toUpperCase()}\n\nTo search this content effectively, consider:\n1. Converting the image to PDF with OCR\n2. Manually transcribing key information\n3. Using a document with embedded text`
        console.log('✅ Image placeholder created')
      } else {
        console.log('📄 Reading file as text (type:', fileType, ')...')
        // For other types, try to read as text
        content = await file.text()
        console.log('✅ File read, length:', content.length)
      }
    } catch (error) {
      console.error('❌ Error parsing document:', error)
      throw new Error('Failed to parse document content')
    }
    
    // Split content into chunks
    console.log('✂️  Splitting content with strategy:', this.config.chunkingStrategy)
    const chunks = this.splitText(content, this.config.chunkingStrategy || 'auto')
    console.log('📊 Created', chunks.length, 'chunks')
    
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
    console.log('💾 Creating storage directory:', storagePath)
    await fs.mkdir(storagePath, { recursive: true })
    
    // For large documents, save metadata and chunks separately
    const docMetadata = {
      id: document.id,
      user_id: document.user_id,
      chat_id: document.chat_id,
      filename: document.filename,
      file_type: document.file_type,
      file_size: document.file_size,
      chunk_count: document.chunk_count,
      created_at: document.created_at,
      embedding_dims: embeddings[0]?.length || 0
    }
    
    const metadataPath = join(storagePath, `${documentId}_metadata.json`)
    const chunksPath = join(storagePath, `${documentId}_chunks.json`)
    
    try {
      console.log('💾 Saving metadata to:', metadataPath)
      await fs.writeFile(metadataPath, JSON.stringify(docMetadata, null, 2))
      
      console.log('💾 Saving chunks to:', chunksPath)
      console.log(`📊 Total size estimate: ${(JSON.stringify(document.chunks).length / 1024 / 1024).toFixed(2)} MB`)
      
      // Save chunks in batches to avoid memory issues
      await fs.writeFile(chunksPath, JSON.stringify(document.chunks))
      
      console.log('✅ Document saved successfully')
    } catch (error) {
      console.error('❌ Error saving document:', error)
      throw new Error('Failed to save document to storage')
    }
    
    return {
      id: document.id,
      filename: document.filename,
      file_size: document.file_size,
      chunk_count: document.chunk_count,
      created_at: document.created_at
    }
  }
  
  async searchDocuments(query: string, chatId: string, limit = 5) {
    console.log('🔍 Searching documents in chat:', chatId)
    
    // Load all documents for this chat
    const storagePath = join(process.cwd(), 'uploads', 'chats', chatId)
    let allResults: any[] = []
    
    try {
      const files = await fs.readdir(storagePath)
      
      // First, check what embedding dimensions were used
      let embeddingDims = 0
      for (const file of files) {
        if (!file.endsWith('_metadata.json')) continue
        const metadataPath = join(storagePath, file)
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
          if (metadata.embedding_dims) {
            embeddingDims = metadata.embedding_dims
            console.log(`📏 Found documents with ${embeddingDims} dimensions`)
            break
          }
        } catch (error) {
          continue
        }
      }
      
      // Adjust config based on detected dimensions
      if (embeddingDims === 1536) {
        console.log('☁️  Detected cloud embeddings, using OpenAI for query')
        this.config.mode = 'cloud'
      } else if (embeddingDims === 384) {
        console.log('🏠 Detected local embeddings, using Xenova for query')
        this.config.mode = 'local'
      }
      
      // Generate query embedding with the same model
      const queryEmbedding = (await this.getEmbeddings([query]))[0]
      console.log(`🔍 Query embedding generated (${queryEmbedding.length} dims)`)
      
      for (const file of files) {
        if (!file.endsWith('_metadata.json')) continue
        
        const docId = file.replace('_metadata.json', '')
        const metadataPath = join(storagePath, file)
        const chunksPath = join(storagePath, `${docId}_chunks.json`)
        
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
          const chunks = JSON.parse(await fs.readFile(chunksPath, 'utf-8'))
          
          // Calculate similarity for each chunk
          for (const chunk of chunks) {
            const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding)
            
            if (similarity > 0.2) {  // Only add if similarity is above threshold
              allResults.push({
                document_id: metadata.id,
                document_name: metadata.filename,
                content: chunk.content,
                similarity,
                metadata: chunk.metadata,
                chunk_index: chunks.indexOf(chunk)
              })
            }
          }
        } catch (error) {
          console.error(`Error loading document ${docId}:`, error)
          continue
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
        if (!file.endsWith('_metadata.json')) continue
        
        const docId = file.replace('_metadata.json', '')
        const metadataPath = join(storagePath, file)
        const chunksPath = join(storagePath, `${docId}_chunks.json`)
        
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
          
          // Get content preview from first chunk
          let contentPreview = ''
          let embeddingDimensions = 0
          try {
            const chunks = JSON.parse(await fs.readFile(chunksPath, 'utf-8'))
            if (chunks.length > 0) {
              contentPreview = chunks[0].content.substring(0, 200) + '...'
              embeddingDimensions = chunks[0].embedding?.length || 0
            }
          } catch (error) {
            console.log('Could not load chunks for preview')
          }
          
          documents.push({
            id: metadata.id,
            filename: metadata.filename,
            file_size: metadata.file_size,
            chunk_count: metadata.chunk_count,
            created_at: metadata.created_at,
            content_preview: contentPreview,
            processing_mode: 'advanced',
            chunking_strategy: metadata.chunking_strategy || this.config.chunkingStrategy,
            embedding_type: embeddingDimensions === 1536 ? 'cloud' : 'local',
            embedding_dimensions: embeddingDimensions
          })
        } catch (error) {
          console.error(`Error loading metadata for ${file}:`, error)
          continue
        }
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
    // Ensure both vectors have the same length
    if (a.length !== b.length) {
      console.warn(`⚠️  Vector dimension mismatch: ${a.length} vs ${b.length}`)
      // Can't compute similarity between vectors of different dimensions
      return 0
    }
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
    return dotProduct / (magnitudeA * magnitudeB)
  }
}

export async function getAdvancedDocumentService(config?: ProcessingConfig) {
  return new AdvancedDocumentService(config)
}