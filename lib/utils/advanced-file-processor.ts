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
   * Enhanced version with multiple fallback options
   *
   * @param fileBuffer - File buffer
   * @param fileName - Original file name
   * @returns Array of processed chunks
   */
  private async processDocumentWithUnstructured(fileBuffer: Buffer, fileName: string): Promise<any[]> {
    try {
      // Get configuration options
      const skipUnstructured = process.env.SKIP_UNSTRUCTURED === 'true';
      const forceSkipUnstructured = process.env.FORCE_SKIP_UNSTRUCTURED === 'true';
      const useCloudApi = process.env.USE_UNSTRUCTURED_CLOUD_API === 'true';
      const enablePythonFallback = process.env.ENABLE_PYTHON_FALLBACK === 'true';
      const useDocling = process.env.USE_DOCLING === 'true';
      
      console.log(`Processing document with options: skipUnstructured=${skipUnstructured}, forceSkipUnstructured=${forceSkipUnstructured}, useCloudApi=${useCloudApi}, enablePythonFallback=${enablePythonFallback}, useDocling=${useDocling}`);
      
      // Skip everything if explicitly configured
      if (forceSkipUnstructured || skipUnstructured) {
        console.log('Skipping unstructured.io, using fallback document processing');
        return this.fallbackProcessDocument(fileBuffer, fileName);
      }
      
      // Try methods in order of preference
      const methods = [];
      
      // 1. Cloud API if configured
      if (useCloudApi && process.env.UNSTRUCTURED_API_KEY) {
        methods.push({
          name: 'Cloud unstructured.io API',
          method: () => this.processWithCloudApi(fileBuffer, fileName)
        });
      }
      
      // 2. Docker container API
      methods.push({
        name: 'Local unstructured.io Docker API',
        method: async () => {
          // Create form data for the request
          const formData = new FormData();
          const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
          formData.append('files', blob, fileName);
          
          // Add parameters
          formData.append('strategy', 'auto');
          formData.append('hi_res_pdf', 'true');
          
          try {
            formData.append('chunking_strategy', JSON.stringify({
              chunk_size: 1000,
              chunk_overlap: 200
            }));
          } catch (e) {
            formData.append('chunk_size', '1000');
            formData.append('chunk_overlap', '200');
          }
          
          // Make the request to local unstructured.io
          const response = await axios.post(this.unstructuredApiUrl, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            timeout: 10000 // 10 second timeout
          });
          
          if (response.data && response.data.elements) {
            return response.data.elements;
          } else if (Array.isArray(response.data)) {
            return response.data;
          }
          
          throw new Error('Invalid response format from unstructured.io API');
        }
      });
      
      // 3. Python wrapper if enabled
      if (enablePythonFallback) {
        methods.push({
          name: 'Python unstructured.io wrapper',
          method: () => this.processDocumentWithPythonUnstructured(fileBuffer, fileName)
        });
      }
      
      // 4. Docling if configured
      if (useDocling) {
        methods.push({
          name: 'Docling processor',
          method: () => this.processDocumentWithDocling(fileBuffer, fileName)
        });
      }
      
      // Try each method in sequence
      let lastError = null;
      for (const { name, method } of methods) {
        try {
          console.log(`Trying document processing with: ${name}`);
          const result = await method();
          console.log(`Successfully processed document with: ${name}`);
          return result;
        } catch (error) {
          console.warn(`Failed to process with ${name}:`, error);
          lastError = error;
        }
      }
      
      // If all methods fail, log the last error and use basic fallback
      console.error('All processing methods failed. Last error:', lastError);
      console.log('Using basic fallback document processing');
      return this.fallbackProcessDocument(fileBuffer, fileName);
    } catch (error) {
      console.error('Error in processDocumentWithUnstructured:', error);
      // Use fallback instead of throwing
      console.log('Using fallback document processing after error');
      return this.fallbackProcessDocument(fileBuffer, fileName);
    }
  }

  /**
   * Process document with unstructured.io using Python wrapper
   * This serves as a fallback when Docker container fails on ARM64
   */
  private async processDocumentWithPythonUnstructured(fileBuffer: Buffer, fileName: string): Promise<any[]> {
    try {
      console.log(`Attempting to use unstructured.io via Python wrapper: ${fileName}`);
      
      if (process.env.ENABLE_PYTHON_FALLBACK !== 'true') {
        console.log('Python fallback not enabled. Skipping.');
        throw new Error('Python fallback not enabled');
      }
      
      // Create a temporary file
      const os = require('os');
      const path = require('path');
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, fileName);
      await fs.promises.writeFile(tempFilePath, fileBuffer);
      
      try {
        // Execute Python script to run unstructured.io
        const { execSync } = require('child_process');
        const result = execSync(
          `python -c "
          import json
          import sys
          
          try:
              from unstructured.partition.auto import partition
              from unstructured.chunking.title import chunk_by_title
              
              elements = partition('${tempFilePath}')
              chunks = chunk_by_title(elements, combine_text_under_n_chars=1000, overlap=200)
              
              # Convert to unstructured.io API response format
              result = [{'id': f'chunk-{i}', 'text': c.text, 'type': c.category,
                        'metadata': {'page_number': getattr(c, 'metadata', {}).get('page_number', 1)}}
                       for i, c in enumerate(chunks)]
              
              print(json.dumps(result))
          except Exception as e:
              print(json.dumps({'error': str(e)}), file=sys.stderr)
              sys.exit(1)
          "`,
          { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
        );
        
        // Parse result
        const parsedResult = JSON.parse(result);
        if (Array.isArray(parsedResult)) {
          console.log(`Successfully processed with Python: ${parsedResult.length} chunks`);
          return parsedResult;
        } else if (parsedResult.error) {
          throw new Error(`Python processing error: ${parsedResult.error}`);
        }
        
        throw new Error('Invalid response format from Python processing');
      } catch (pythonError) {
        console.error('Error using Python unstructured.io:', pythonError);
        throw pythonError;
      } finally {
        // Clean up temp file
        try {
          await fs.promises.unlink(tempFilePath);
        } catch (e) {
          console.error('Error cleaning up temp file:', e);
        }
      }
    } catch (error) {
      console.error('Python unstructured.io processing failed:', error);
      throw error;
    }
  }

  /**
   * Process document using docling (future implementation)
   * This serves as an alternative document processor option
   */
  private async processDocumentWithDocling(fileBuffer: Buffer, fileName: string): Promise<any[]> {
    try {
      console.log(`Attempting to use docling for document processing: ${fileName}`);
      
      if (process.env.USE_DOCLING !== 'true') {
        console.log('Docling processing not enabled. Skipping.');
        throw new Error('Docling processing not enabled');
      }
      
      // This is a placeholder for actual implementation
      // Refer to docs/DOCLING_INTEGRATION.md for implementation details
      
      // Method 1: If using Docling Node.js library
      try {
        // This will fail if docling is not installed - that's expected for now
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { processDocument } = require('docling');
        const result = await processDocument(fileBuffer, {
          filename: fileName,
          chunkSize: 1000,
          chunkOverlap: 200
        });
        
        // Convert Docling result to unstructured.io format for compatibility
        return result.chunks.map((chunk: any, index: number) => ({
          id: `docling-chunk-${index}`,
          text: chunk.text,
          type: chunk.type || 'NarrativeText',
          metadata: {
            page_number: chunk.pageNumber || 1
          }
        }));
      } catch (nodeJsError) {
        console.error('Error using Docling Node.js library:', nodeJsError);
        throw new Error('Docling Node.js library not available. Install with npm install docling');
      }
    } catch (error) {
      console.error('Docling processing failed:', error);
      throw error;
    }
  }

  /**
   * Process document using cloud unstructured.io API
   */
  private async processWithCloudApi(fileBuffer: Buffer, fileName: string): Promise<any[]> {
    try {
      console.log('Using cloud unstructured.io API');
      const apiKey = process.env.UNSTRUCTURED_API_KEY;
      const apiUrl = 'https://api.unstructured.io/general/v0/general';
      
      // Prepare form data for the API request
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
      formData.append('files', blob, fileName);
      formData.append('strategy', 'auto');
      formData.append('hi_res_pdf', 'true');
      
      // Make API request
      const response = await axios.post(apiUrl, formData, {
        headers: {
          'Accept': 'application/json',
          'unstructured-api-key': apiKey
        }
      });
      
      return response.data.elements || [];
    } catch (error) {
      console.error('Error processing with cloud API:', error);
      return this.fallbackProcessDocument(fileBuffer, fileName);
    }
  }
  
  /**
   * Fallback document processing using simple text extraction and chunking
   * Used when unstructured.io is unavailable (especially for ARM64 Macs)
   */
  private async fallbackProcessDocument(fileBuffer: Buffer, fileName: string): Promise<any[]> {
    console.log(`Using fallback document processing for ${fileName}`);
    
    // Use simple text extraction based on file type
    let textContent = '';
    
    try {
      // For PDF files
      if (fileName.toLowerCase().endsWith('.pdf')) {
        try {
          // Try a more direct approach to avoid file path issues
          // @ts-ignore - Ignore TypeScript errors for now
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(fileBuffer);
          textContent = data.text;
        } catch (pdfError) {
          console.error('PDF extraction error:', pdfError);
          // Provide meaningful content even if extraction fails
          textContent = `[PDF CONTENT SUMMARY: This is a PDF document named "${fileName}" with size ${fileBuffer.length} bytes. The text extraction failed with error: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}]`;
        }
      }
      // For text files
      else if (fileName.match(/\.(txt|md|html|htm|json|xml|js|ts|css|csv)$/i)) {
        textContent = fileBuffer.toString('utf8');
      }
      // For other files, return placeholder
      else {
        textContent = `Content from ${fileName} (Extracted in fallback mode)`;
      }
      
      // Simple chunking strategy - split by paragraphs and limit size
      const chunks = [];
      const paragraphs = textContent.split(/\n\s*\n/);
      const maxChunkSize = 1000;
      
      let currentChunk = '';
      let currentChunkSize = 0;
      let chunkIndex = 0;
      
      for (const paragraph of paragraphs) {
        // Skip empty paragraphs
        if (paragraph.trim().length === 0) continue;
        
        // If adding this paragraph would exceed max size, save current chunk
        if (currentChunkSize + paragraph.length > maxChunkSize && currentChunkSize > 0) {
          chunks.push({
            id: `chunk-${chunkIndex++}`,
            text: currentChunk,
            type: 'NarrativeText',
            metadata: {
              page_number: Math.floor(chunkIndex / 5) + 1,  // Approximate page numbers
              filename: fileName
            }
          });
          currentChunk = '';
          currentChunkSize = 0;
        }
        
        currentChunk += paragraph + '\n\n';
        currentChunkSize += paragraph.length + 2;
      }
      
      // Add the last chunk if not empty
      if (currentChunkSize > 0) {
        chunks.push({
          id: `chunk-${chunkIndex++}`,
          text: currentChunk,
          type: 'NarrativeText',
          metadata: {
            page_number: Math.floor(chunkIndex / 5) + 1,
            filename: fileName
          }
        });
      }
      
      console.log(`Fallback processing created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      console.error('Error in fallback document processing:', error);
      // Return at least one chunk with an error message
      return [{
        id: 'error-chunk',
        text: `Failed to extract text from ${fileName}. Please try a different file format.`,
        type: 'NarrativeText',
        metadata: { error: true, filename: fileName }
      }];
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
    // Always return vectors even if Qdrant fails
    const vectors: ChunkVector[] = [];
    
    try {
      // Check if Qdrant is available
      const qdrantAvailable = await this.isQdrantAvailable();
      
      if (!qdrantAvailable) {
        console.log('Qdrant is not available, using fallback storage');
        // Create vectors without storing in Qdrant
        for (const chunk of chunks) {
          vectors.push({
            chunkId: chunk.id,
            embedding: [], // Empty embedding for fallback
            metadata: {
              documentId: chunk.metadata?.documentId || fileId,
              sectionTitle: chunk.metadata?.sectionTitle,
              position: chunk.metadata?.position
            }
          });
        }
        return vectors;
      }
      
      // Qdrant is available, proceed with normal flow
      await this.ensureCollection(this.collectionName);
      
      // Process chunks in batches
      const batchSize = 50; // Reduced batch size for better reliability
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        try {
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
            
            // Generate a unique string ID
            const pointId = `${fileId}_${chunk.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
            
            return {
              id: pointId,
              vector: embeddingResults[index],
              payload: {
                text: chunk.content,
                chunkId: chunk.id,
                metadata: chunk.metadata
              }
            };
          });
          
          // Upsert points with better error handling
          try {
            await this.qdrantClient.upsert(this.collectionName, {
              points,
              wait: true
            });
          } catch (upsertError) {
            console.error('Error upserting batch to Qdrant:', upsertError);
            // Continue with next batch instead of failing completely
          }
        } catch (batchError) {
          console.error('Error processing batch:', batchError);
          // Continue with next batch
        }
      }
      
      return vectors;
    } catch (error) {
      console.error('Error storing document chunks:', error);
      // Return the vectors we have so far instead of failing
      return vectors;
    }
  }
  
  /**
   * Check if Qdrant is available
   *
   * @returns Boolean indicating if Qdrant is available
   */
  private async isQdrantAvailable(): Promise<boolean> {
    try {
      // Try to list collections as a way to check if Qdrant is available
      await this.qdrantClient.getCollections();
      return true;
    } catch (error) {
      console.error('Qdrant availability check failed:', error);
      return false;
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