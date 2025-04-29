import axios from 'axios';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../redis/config';
import { ChunkVector, DocumentChunk, FileAttachment, FileProcessor, ProcessedFile } from '../types/file';
import { getAbsoluteFilePath } from './file-utils';

// Import Qdrant client
import { QdrantClient } from '@qdrant/js-client-rest';

// Create Redis client promise
const redisPromise = getRedisClient();

/**
 * Advanced file processor implementation using local unstructured.io and Qdrant
 */
export class AdvancedFileProcessor implements FileProcessor {
  private qdrantClient: QdrantClient;
  private unstructuredApiUrl: string;
  private collectionName: string = 'document_chunks';
  private embeddingDimension: number = 1536;  // For text-embedding-3-small

  /**
   * Constructor to initialize clients
   */
  constructor() {
    // Use local unstructured.io instance
    this.unstructuredApiUrl = process.env.UNSTRUCTURED_API_URL || 'http://localhost:8000/general/v0/general';
    
    // Use local Qdrant instance
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
  }

  /**
   * Process a file to extract text, create chunks, and store vectors
   * 
   * @param file - File attachment metadata
   * @returns ProcessedFile with extracted text and chunks
   */
  async process(file: FileAttachment): Promise<ProcessedFile> {
    try {
      // Update processing status
      file.processingStatus = 'processing';
      await this.updateFileMetadata(file);
      
      // Read file
      const fileBuffer = await fs.promises.readFile(getAbsoluteFilePath(file.storagePath));
      
      // Process with local unstructured.io
      const chunks = await this.processDocumentWithUnstructured(fileBuffer, file.originalName);
      
      // Create document chunks
      const documentChunks = this.createDocumentChunks(chunks, file.id);
      
      // Store the chunks in Qdrant
      const vectors = await this.storeDocumentChunks(documentChunks, file.id);
      
      // Update file metadata
      file.processingStatus = 'completed';
      
      // Store a plain text version for direct access
      file.extractedText = documentChunks
        .map(chunk => chunk.content)
        .join('\n\n');
      
      // Update in Redis
      await this.updateFileMetadata(file);
      
      // Add chunk count to Redis separately
      const redis = await redisPromise;
      await redis.hmset(`file:${file.id}:metadata`, { chunkCount: documentChunks.length.toString() });
      
      return {
        id: file.id,
        chunks: documentChunks,
        vectors
      };
    } catch (error) {
      console.error(`Error processing file ${file.id}:`, error);
      file.processingStatus = 'failed';
      file.error = error instanceof Error ? error.message : 'Unknown error';
      await this.updateFileMetadata(file);
      throw error;
    }
  }

  /**
   * Process a document with local unstructured.io
   * 
   * @param fileBuffer - File buffer
   * @param fileName - Original file name
   * @returns Array of processed chunks
   */
  private async processDocumentWithUnstructured(fileBuffer: Buffer, fileName: string): Promise<any[]> {
    try {
      // Create form data for the request
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('files', blob, fileName);
      
      // Add parameters
      formData.append('strategy', 'auto');
      formData.append('hi_res_pdf', 'true');
      formData.append('chunking_strategy', JSON.stringify({
        chunk_size: 1000,
        chunk_overlap: 200
      }));
      
      // Make the request to local unstructured.io
      const response = await axios.post(this.unstructuredApiUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data.elements || [];
    } catch (error) {
      console.error('Error processing document with unstructured.io:', error);
      throw new Error('Failed to process document with unstructured.io');
    }
  }

  /**
   * Create document chunks from unstructured elements
   * 
   * @param elements - Elements from unstructured.io
   * @param documentId - Document ID
   * @returns Array of document chunks
   */
  private createDocumentChunks(elements: any[], documentId: string): DocumentChunk[] {
    return elements.map((element, index) => {
      return {
        id: uuidv4(),
        content: element.text || '',
        metadata: {
          documentId,
          position: index,
          sectionTitle: element.metadata?.title,
          sectionLevel: element.metadata?.level,
          chunkType: element.type,
          pageNumber: element.metadata?.page_number
        }
      };
    });
  }

  /**
   * Ensure Qdrant collection exists
   * 
   * @param collectionName - Collection name
   */
  private async ensureCollection(collectionName: string): Promise<void> {
    try {
      const collections = await this.qdrantClient.getCollections();
      
      const collectionExists = collections.collections?.some((c: { name: string }) => c.name === collectionName);
      
      if (!collectionExists) {
        await this.qdrantClient.createCollection(collectionName, {
          vectors: {
            size: this.embeddingDimension,
            distance: 'Cosine'
          }
        });
      }
    } catch (error) {
      console.error('Error ensuring collection:', error);
      throw new Error('Failed to ensure Qdrant collection');
    }
  }

  /**
   * Create embeddings for a batch of texts
   * 
   * @param texts - Array of texts to embed
   * @returns Array of embeddings
   */
  private async createEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // Use local embedding service or OpenAI
      const response = await axios.post(
        process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1/embeddings',
        {
          input: texts,
          model: 'text-embedding-3-small'
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.data.map((item: any) => item.embedding);
    } catch (error) {
      console.error('Error creating embeddings:', error);
      throw new Error('Failed to create embeddings');
    }
  }

  /**
   * Store document chunks in Qdrant
   * 
   * @param chunks - Document chunks
   * @param fileId - File ID
   * @returns Array of chunk vectors
   */
  private async storeDocumentChunks(chunks: DocumentChunk[], fileId: string): Promise<ChunkVector[]> {
    try {
      await this.ensureCollection(this.collectionName);
      
      // Process chunks in batches
      const batchSize = 100;
      const vectors: ChunkVector[] = [];
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        // Create embeddings for the batch
        const texts = batch.map(chunk => chunk.content);
        const embeddingResults = await this.createEmbeddings(texts);
        
        // Prepare points for Qdrant
        const points = batch.map((chunk, index) => {
          // Store vector in our result
          vectors.push({
            chunkId: chunk.id,
            embedding: embeddingResults[index],
            metadata: {
              documentId: chunk.metadata?.documentId || fileId,
              sectionTitle: chunk.metadata?.sectionTitle,
              position: chunk.metadata?.position
            }
          });
          
          return {
            id: `${fileId}_${chunk.id}`,
            vector: embeddingResults[index],
            payload: {
              text: chunk.content,
              chunkId: chunk.id,
              metadata: chunk.metadata
            }
          };
        });
        
        // Upsert points
        await this.qdrantClient.upsert(this.collectionName, {
          points
        });
      }
      
      return vectors;
    } catch (error) {
      console.error('Error storing document chunks:', error);
      throw new Error('Failed to store document chunks in Qdrant');
    }
  }

  /**
   * Update file metadata in Redis
   * 
   * @param file - File attachment metadata
   */
  private async updateFileMetadata(file: FileAttachment): Promise<void> {
    try {
      const redis = await redisPromise;
      
      // Prepare the file data for Redis
      const fileData: Record<string, string> = {
        id: file.id,
        originalName: file.originalName,
        storagePath: file.storagePath,
        mimeType: file.mimeType,
        size: file.size.toString(),
        uploadedAt: file.uploadedAt.toISOString(),
        processingStatus: file.processingStatus || 'pending'
      };
      
      if (file.extractedText) {
        fileData.extractedText = file.extractedText;
      }
      
      if (file.error) {
        fileData.error = file.error;
      }
      
      // Store in Redis
      await redis.hmset(`file:${file.id}`, fileData);
    } catch (error) {
      console.error('Error updating file metadata:', error);
      throw new Error('Failed to update file metadata in Redis');
    }
  }
}

/**
 * Search for relevant chunks based on a query
 * 
 * @param query - Search query
 * @param fileIds - Array of file IDs
 * @param limit - Maximum number of results
 * @returns Array of relevant chunks with scores
 */
export async function searchRelevantChunks(query: string, fileIds: string[], limit: number = 5): Promise<any[]> {
  try {
    const collectionName = 'document_chunks';
    
    // Initialize the QdrantClient
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });
    
    // Create embedding for the query
    const response = await axios.post(
      process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1/embeddings',
      {
        input: [query],
        model: 'text-embedding-3-small'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const queryEmbedding = response.data.data[0].embedding;
    
    // Create filter to search only in the relevant files
    const filter = fileIds.length > 0 ? {
      should: fileIds.map(fileId => ({
        key: 'metadata.documentId',
        match: {
          value: fileId
        }
      }))
    } : undefined;
    
    // Search for similar chunks
    const searchResult = await qdrantClient.search(collectionName, {
      vector: queryEmbedding,
      limit,
      filter
    });
    
    return searchResult.map(result => ({
      text: result.payload?.text || '',
      score: result.score || 0,
      metadata: result.payload?.metadata || {},
      chunkId: result.payload?.chunkId || ''
    }));
  } catch (error) {
    console.error('Error searching relevant chunks:', error);
    return [];
  }
}

/**
 * Generate enhanced context for AI based on the query
 * 
 * @param messages - Chat messages
 * @param fileIds - Array of file IDs
 * @returns Messages with enhanced context
 */
export async function generateEnhancedContext(messages: any[], fileIds: string[]): Promise<any[]> {
  if (!fileIds || fileIds.length === 0) {
    return messages;
  }
  
  try {
    // Extract user query from last message
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return messages;
    
    const userQuery = lastUserMessage.content as string;
    
    // Search for relevant chunks based on the query
    const relevantChunks = await searchRelevantChunks(userQuery, fileIds, 10);
    
    if (relevantChunks.length === 0) return messages;
    
    // Build context from relevant chunks
    const context = `Relevant information from attached documents:
${relevantChunks.map(chunk => 
  `---
${chunk.text}
(Source: ${chunk.metadata.documentId}, Page: ${chunk.metadata.pageNumber || 'N/A'}, Relevance: ${(chunk.score * 100).toFixed(2)}%)
`).join('\n')}`;
    
    // Add context as a system message
    const messagesWithContext = [...messages];
    const lastUserIndex = messagesWithContext.findLastIndex(m => m.role === 'user');
    
    messagesWithContext.splice(lastUserIndex, 0, {
      id: `context-${Date.now()}`,
      role: 'system',
      content: context
    });
    
    return messagesWithContext;
  } catch (error) {
    console.error('Error generating enhanced context:', error);
    return messages;
  }
}

/**
 * Factory function to create an instance of AdvancedFileProcessor
 * 
 * @returns FileProcessor instance
 */
export function createAdvancedFileProcessor(): FileProcessor {
  return new AdvancedFileProcessor();
}