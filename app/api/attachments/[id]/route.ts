import { FileAttachment } from '@/lib/types/file'
import { getAbsoluteFilePath } from '@/lib/utils/file-utils'
import { Redis } from '@upstash/redis'
import fs from 'fs'
import { NextRequest, NextResponse } from 'next/server'

// Create Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || ''
})

/**
 * Get file metadata from Redis
 */
async function getFileMetadata(fileId: string): Promise<FileAttachment | null> {
  try {
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
 * Handle GET request to retrieve a file's metadata or content
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const fileId = params.id
    const download = req.nextUrl.searchParams.get('download') === 'true'
    const metadata = req.nextUrl.searchParams.get('metadata') === 'true'
    
    // Get file metadata
    const fileAttachment = await getFileMetadata(fileId)
    
    if (!fileAttachment) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    // Return only metadata if requested
    if (metadata) {
      return NextResponse.json({
        id: fileAttachment.id,
        originalName: fileAttachment.originalName,
        mimeType: fileAttachment.mimeType,
        size: fileAttachment.size,
        uploadedAt: fileAttachment.uploadedAt,
        processingStatus: fileAttachment.processingStatus,
        extractedText: fileAttachment.extractedText || undefined
      })
    }
    
    // Handle file download
    if (download) {
      const filePath = getAbsoluteFilePath(fileAttachment.storagePath)
      
      // Check if file exists
      try {
        await fs.promises.access(filePath, fs.constants.F_OK)
      } catch (error) {
        return NextResponse.json(
          { error: 'File content not found' },
          { status: 404 }
        )
      }
      
      // Read file and prepare for download
      const fileBuffer = await fs.promises.readFile(filePath)
      
      // Set appropriate headers
      const headers = new Headers()
      headers.set('Content-Type', fileAttachment.mimeType)
      headers.set('Content-Disposition', `attachment; filename="${fileAttachment.originalName}"`)
      headers.set('Content-Length', fileAttachment.size.toString())
      
      return new NextResponse(fileBuffer, {
        status: 200,
        headers
      })
    }
    
    // If neither metadata nor download is specified, return basic info
    return NextResponse.json({
      id: fileAttachment.id,
      originalName: fileAttachment.originalName,
      mimeType: fileAttachment.mimeType,
      size: fileAttachment.size,
      uploadedAt: fileAttachment.uploadedAt,
      processingStatus: fileAttachment.processingStatus
    })
  } catch (error) {
    console.error('Error handling file retrieval:', error)
    
    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    )
  }
}

/**
 * Handle DELETE request to remove a file
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const fileId = params.id
    
    // Get file metadata
    const fileAttachment = await getFileMetadata(fileId)
    
    if (!fileAttachment) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }
    
    // Delete the file from storage
    const filePath = getAbsoluteFilePath(fileAttachment.storagePath)
    
    try {
      await fs.promises.unlink(filePath)
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error)
      // Continue even if file deletion fails
    }
    
    // Delete metadata from Redis
    await redis.del(`file:${fileId}`)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling file deletion:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}