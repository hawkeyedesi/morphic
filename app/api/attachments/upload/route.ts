import { FileAttachment } from '@/lib/types/file'
import { storeFile, validateFile } from '@/lib/utils/file-utils'
import { Redis } from '@upstash/redis'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Create Redis client
// Create Redis client
let redis: Redis;

try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  });
} catch (error) {
  console.warn('Redis client initialization failed, using mock implementation');
  
  // Create a mock Redis implementation for demo purposes
  const fileStore: Record<string, any> = {};
  const setStore: Record<string, Set<string>> = {};
  
  redis = {
    hset: async (key: string, field: Record<string, unknown>) => {
      fileStore[key] = field;
      return 'OK';
    },
    hgetall: async (key: string) => fileStore[key] || null,
    sadd: async (key: string, ...members: string[]) => {
      if (!setStore[key]) {
        setStore[key] = new Set();
      }
      members.forEach(member => setStore[key].add(member));
      return members.length;
    },
    smembers: async (key: string) => Array.from(setStore[key] || [])
  } as unknown as Redis;
}

/**
 * Maximum file size (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Allowed file types
 */
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/html',
  'text/css',
  'text/javascript',
  'application/json',
  'application/xml',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

/**
 * Get user ID from cookie
 */
async function getUserId(req: NextRequest): Promise<string> {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  // For demo purposes, return a default user ID if not authenticated
  return userId || 'demo-user'
}

/**
 * Store file attachment metadata in Redis
 */
async function storeFileMetadata(
  fileAttachment: FileAttachment,
  chatId: string
): Promise<void> {
  // Convert FileAttachment to a Record<string, unknown>
  const fileMetadata: Record<string, unknown> = {
    id: fileAttachment.id,
    originalName: fileAttachment.originalName,
    storagePath: fileAttachment.storagePath,
    mimeType: fileAttachment.mimeType,
    size: fileAttachment.size,
    uploadedAt: fileAttachment.uploadedAt.toISOString(),
    processingStatus: fileAttachment.processingStatus,
    extractedText: fileAttachment.extractedText
  }
  
  // Store file metadata
  await redis.hset(`file:${fileAttachment.id}`, fileMetadata)
  
  // Add file ID to chat's file list
  await redis.sadd(`chat:${chatId}:files`, fileAttachment.id)
}

/**
 * Handle file upload request
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Get the user ID from the cookie
    const userId = await getUserId(req)
    
    // Parse the form data
    const formData = await req.formData()
    const chatId = formData.get('chatId') as string
    
    // Validate chat ID
    if (!chatId) {
      return NextResponse.json(
        { error: 'Chat ID is required' },
        { status: 400 }
      )
    }
    
    // Get files from form data
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }
    
    // Process each file
    const uploadResults = await Promise.all(
      files.map(async (file) => {
        // Validate file
        const validation = validateFile(file, MAX_FILE_SIZE, ALLOWED_FILE_TYPES)
        
        if (!validation.valid) {
          return {
            originalName: file.name,
            error: validation.error,
            success: false
          }
        }
        
        try {
          // Store the file
          const fileAttachment = await storeFile(file, userId, chatId)
          
          // Store metadata in Redis
          await storeFileMetadata(fileAttachment, chatId)
          
          return {
            id: fileAttachment.id,
            originalName: fileAttachment.originalName,
            mimeType: fileAttachment.mimeType,
            size: fileAttachment.size,
            success: true
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error)
          
          return {
            originalName: file.name,
            error: 'Failed to process file',
            success: false
          }
        }
      })
    )
    
    return NextResponse.json({ files: uploadResults })
  } catch (error) {
    console.error('Error handling file upload:', error)
    
    return NextResponse.json(
      { error: 'Failed to process file upload' },
      { status: 500 }
    )
  }
}