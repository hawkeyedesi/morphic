import { FileAttachment } from '@/lib/types/file'
import { Redis } from '@upstash/redis'
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
 * Get all file IDs associated with a chat
 */
async function getChatFileIds(chatId: string): Promise<string[]> {
  try {
    return await redis.smembers(`chat:${chatId}:files`) as string[]
  } catch (error) {
    console.error(`Error retrieving file IDs for chat ${chatId}:`, error)
    return []
  }
}

/**
 * List all files attached to a chat
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Get chat ID from query params
    const chatId = req.nextUrl.searchParams.get('chatId')
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      )
    }
    
    // Get all file IDs for this chat
    const fileIds = await getChatFileIds(chatId)
    
    if (fileIds.length === 0) {
      return NextResponse.json({ files: [] })
    }
    
    // Get metadata for each file
    const filePromises = fileIds.map(fileId => getFileMetadata(fileId))
    const filesWithNulls = await Promise.all(filePromises)
    
    // Filter out null values (files that might have been deleted)
    const files = filesWithNulls.filter(file => file !== null) as FileAttachment[]
    
    // Map to return only necessary information
    const fileList = files.map(file => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
      uploadedAt: file.uploadedAt,
      processingStatus: file.processingStatus
    }))
    
    return NextResponse.json({ files: fileList })
  } catch (error) {
    console.error('Error listing chat files:', error)
    
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}