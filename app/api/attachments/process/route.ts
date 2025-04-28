import { getRedisClient } from '@/lib/redis/config'
import { FileAttachment } from '@/lib/types/file'
import { createFileProcessor } from '@/lib/utils/file-processor'
import { NextRequest, NextResponse } from 'next/server'

// Create Redis client promise
const redisPromise = getRedisClient()

/**
 * Get file metadata from Redis
 */
async function getFileMetadata(fileId: string): Promise<FileAttachment | null> {
  try {
    const redis = await redisPromise
    const data = await redis.hgetall(`file:${fileId}`) as any
    
    if (!data || !data.id) {
      return null
    }
    
    // Convert date string back to Date object
    if (data.uploadedAt) {
      data.uploadedAt = new Date(data.uploadedAt)
    }
    
    return data as FileAttachment
  } catch (error) {
    console.error(`Error retrieving file metadata for ${fileId}:`, error)
    return null
  }
}

/**
 * Update file metadata in Redis
 */
async function updateFileMetadata(fileAttachment: FileAttachment): Promise<void> {
  // Get Redis client
  const redis = await redisPromise
  
  // Convert FileAttachment to a Record<string, unknown>
  const fileMetadata: Record<string, unknown> = {
    id: fileAttachment.id,
    originalName: fileAttachment.originalName,
    storagePath: fileAttachment.storagePath,
    mimeType: fileAttachment.mimeType,
    size: fileAttachment.size,
    uploadedAt: fileAttachment.uploadedAt.toISOString(),
    processingStatus: fileAttachment.processingStatus,
    extractedText: fileAttachment.extractedText,
    error: fileAttachment.error
  }
  
  // Store file metadata
  await redis.hmset(`file:${fileAttachment.id}`, fileMetadata)
}

/**
 * Process a file to extract its content
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { fileId } = await req.json()
    
    if (!fileId) {
      return NextResponse.json(
        { error: 'File ID is required' },
        { status: 400 }
      )
    }
    
    // Get file metadata
    const fileAttachment = await getFileMetadata(fileId)
    
    if (!fileAttachment) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    // Skip processing if already completed or failed
    if (fileAttachment.processingStatus === 'completed') {
      return NextResponse.json({
        id: fileAttachment.id,
        status: 'completed',
        message: 'File already processed'
      })
    }
    
    if (fileAttachment.processingStatus === 'failed') {
      return NextResponse.json({
        id: fileAttachment.id,
        status: 'failed',
        error: fileAttachment.error || 'Processing previously failed'
      }, { status: 422 })
    }
    
    try {
      // Create file processor and process file
      const fileProcessor = createFileProcessor()
      
      // Update status to processing
      fileAttachment.processingStatus = 'processing'
      await updateFileMetadata(fileAttachment)
      
      // Process the file
      const processedFile = await fileProcessor.process(fileAttachment)
      
      // Update file metadata with extracted text
      fileAttachment.processingStatus = 'completed'
      await updateFileMetadata(fileAttachment)
      
      return NextResponse.json({
        id: fileAttachment.id,
        status: 'completed',
        chunks: processedFile.chunks.length
      })
    } catch (error) {
      console.error(`Error processing file ${fileId}:`, error)
      
      // Update file status to failed
      fileAttachment.processingStatus = 'failed'
      fileAttachment.error = error instanceof Error ? error.message : 'Unknown error during processing'
      await updateFileMetadata(fileAttachment)
      
      return NextResponse.json({
        id: fileAttachment.id,
        status: 'failed',
        error: fileAttachment.error
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error handling file processing request:', error)
    
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}