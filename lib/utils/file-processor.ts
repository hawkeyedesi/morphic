import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { DocumentChunk, FileAttachment, FileProcessor, ProcessedFile } from '../types/file'
import { getAbsoluteFilePath } from './file-utils'

// Import document processing libraries
import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

/**
 * Default implementation of FileProcessor interface
 */
export class DefaultFileProcessor implements FileProcessor {
  /**
   * Process a file to extract text and create chunks
   * 
   * @param file - File attachment metadata
   * @returns ProcessedFile with extracted text and chunks
   */
  async process(file: FileAttachment): Promise<ProcessedFile> {
    try {
      // Update processing status
      file.processingStatus = 'processing'
      
      // Extract text based on file type
      const extractedText = await this.extractText(file)
      
      // Update file with extracted text
      file.extractedText = extractedText
      file.processingStatus = 'completed'
      
      // Create chunks from extracted text
      const chunks = this.createChunks(extractedText, file.id)
      
      return {
        id: file.id,
        chunks
      }
    } catch (error) {
      console.error(`Error processing file ${file.id}:`, error)
      file.processingStatus = 'failed'
      file.error = error instanceof Error ? error.message : 'Unknown error'
      throw error
    }
  }
  
  /**
   * Extract text from a file based on its MIME type
   * 
   * @param file - File attachment metadata
   * @returns Extracted text content
   */
  private async extractText(file: FileAttachment): Promise<string> {
    const filePath = getAbsoluteFilePath(file.storagePath)
    const buffer = await fs.promises.readFile(filePath)
    
    switch (file.mimeType) {
      case 'application/pdf':
        return this.extractFromPdf(buffer)
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDocx(buffer)
        
      case 'text/plain':
      case 'text/markdown':
      case 'text/html':
      case 'text/css':
      case 'text/javascript':
      case 'application/json':
      case 'application/xml':
        return buffer.toString('utf-8')
        
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
        // For images, we currently just return the file name
        // In a future enhancement, this could be integrated with image analysis
        return `Image: ${file.originalName}`
        
      default:
        throw new Error(`Unsupported file type: ${file.mimeType}`)
    }
  }
  
  /**
   * Extract text from a PDF file
   * 
   * @param buffer - PDF file buffer
   * @returns Extracted text
   */
  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const pdfData = await pdfParse(buffer)
      return pdfData.text
    } catch (error) {
      console.error('Error extracting text from PDF:', error)
      throw new Error('Failed to extract text from PDF')
    }
  }
  
  /**
   * Extract text from a DOCX file
   * 
   * @param buffer - DOCX file buffer
   * @returns Extracted text
   */
  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer })
      return result.value
    } catch (error) {
      console.error('Error extracting text from DOCX:', error)
      throw new Error('Failed to extract text from DOCX')
    }
  }
  
  /**
   * Create chunks from extracted text
   * 
   * @param text - Extracted text
   * @param documentId - Document ID
   * @param chunkSize - Maximum size of each chunk (default: 1000 characters)
   * @param chunkOverlap - Overlap between chunks (default: 200 characters)
   * @returns Array of document chunks
   */
  private createChunks(
    text: string,
    documentId: string,
    chunkSize: number = 1000,
    chunkOverlap: number = 200
  ): DocumentChunk[] {
    if (!text || text.length === 0) {
      return []
    }
    
    const chunks: DocumentChunk[] = []
    let startIndex = 0
    
    while (startIndex < text.length) {
      // Calculate end index with chunk size
      let endIndex = startIndex + chunkSize
      
      // Adjust end index to avoid cutting words
      if (endIndex < text.length) {
        // Find the next space after the calculated end index
        const nextSpace = text.indexOf(' ', endIndex)
        if (nextSpace !== -1 && nextSpace - endIndex < 50) {
          // If the next space is not too far, use it as the end index
          endIndex = nextSpace
        } else {
          // Otherwise, find the last space before the calculated end index
          const lastSpace = text.lastIndexOf(' ', endIndex)
          if (lastSpace > startIndex) {
            endIndex = lastSpace
          }
        }
      } else {
        endIndex = text.length
      }
      
      // Create chunk
      const chunkContent = text.substring(startIndex, endIndex).trim()
      if (chunkContent) {
        chunks.push({
          id: uuidv4(),
          content: chunkContent,
          metadata: {
            documentId,
            position: startIndex
          }
        })
      }
      
      // Move start index for next chunk, accounting for overlap
      startIndex = endIndex - chunkOverlap
      
      // Ensure we make progress even with large overlap
      if (startIndex <= (endIndex - chunkSize / 2)) {
        startIndex = endIndex
      }
    }
    
    return chunks
  }
}

/**
 * Create a file processor instance
 * 
 * @returns FileProcessor instance
 */
export function createFileProcessor(): FileProcessor {
  return new DefaultFileProcessor()
}