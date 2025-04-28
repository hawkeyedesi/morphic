import { Redis } from '@upstash/redis'
import { FileAttachment } from '../types/file'

// Create Redis client or mock implementation
let redis: Redis

try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!
  })
} catch (error) {
  console.warn('Redis client initialization failed in attachment-utils, using mock implementation')
  
  // Create a mock Redis implementation for demo purposes
  const fileStore: Record<string, any> = {}
  const setStore: Record<string, Set<string>> = {}
  
  redis = {
    hgetall: async (key: string) => fileStore[key] || null,
    smembers: async (key: string) => Array.from(setStore[key] || [])
  } as unknown as Redis
}

/**
 * Retrieves file attachments for a chat
 * 
 * @param chatId - The chat ID
 * @returns Array of file attachments
 */
export async function getFileAttachmentsForChat(chatId: string): Promise<FileAttachment[]> {
  try {
    // Get file IDs for the chat
    const fileIds = await redis.smembers(`chat:${chatId}:files`)
    
    if (!fileIds || fileIds.length === 0) {
      return []
    }
    
    // Get file metadata for each file
    const fileAttachments: FileAttachment[] = []
    
    for (const fileId of fileIds) {
      const fileData = await redis.hgetall(`file:${fileId}`)
      
      if (fileData) {
        // Convert the Redis data to a FileAttachment object
        const fileAttachment: FileAttachment = {
          id: fileData.id as string,
          originalName: fileData.originalName as string,
          storagePath: fileData.storagePath as string,
          mimeType: fileData.mimeType as string,
          size: parseInt(fileData.size as string),
          uploadedAt: new Date(fileData.uploadedAt as string),
          processingStatus: fileData.processingStatus as 'pending' | 'processing' | 'completed' | 'failed',
          extractedText: fileData.extractedText as string | undefined,
          error: fileData.error as string | undefined
        }
        
        fileAttachments.push(fileAttachment)
      }
    }
    
    return fileAttachments
  } catch (error) {
    console.error('Error retrieving file attachments:', error)
    return []
  }
}

/**
 * Processes messages to include file attachment content as context
 * 
 * @param messages - The chat messages
 * @param chatId - The chat ID
 * @returns Processed messages with file content as context
 */
export async function processFileAttachments(messages: any[], chatId: string): Promise<any[]> {
  // Clone the messages to avoid modifying the original array
  const processedMessages = [...messages]
  
  try {
    // Get file attachments for the chat
    const fileAttachments = await getFileAttachmentsForChat(chatId)
    
    if (!fileAttachments || fileAttachments.length === 0) {
      return processedMessages
    }
    
    // Create a context message with file content
    const fileContexts = fileAttachments
      .filter(file => file.extractedText)
      .map(file => {
        return `=== File: ${file.originalName} ===\n${file.extractedText}\n\n`
      })
    
    if (fileContexts.length === 0) {
      return processedMessages
    }
    
    // Create a context message
    const contextMessage = {
      id: `file-context-${Date.now()}`,
      role: 'system',
      content: `The following files have been attached to this conversation. Use this information to answer the user's questions:\n\n${fileContexts.join('')}`
    }
    
    // Find the index to insert the context
    // We want to insert it before the last user message
    const lastUserMessageIndex = [...processedMessages].reverse().findIndex(m => m.role === 'user')
    
    if (lastUserMessageIndex >= 0) {
      // Insert before the last user message
      processedMessages.splice(processedMessages.length - lastUserMessageIndex - 1, 0, contextMessage)
    } else {
      // If no user message found, add at the beginning
      processedMessages.unshift(contextMessage)
    }
  } catch (error) {
    console.error('Error processing file attachments:', error)
  }
  
  return processedMessages
}

/**
 * Check if a message contains file attachments
 * 
 * @param message - The message to check
 * @returns True if the message contains file attachments
 */
export function hasFileAttachments(message: any): boolean {
  return message?.fileAttachments && Array.isArray(message.fileAttachments) && message.fileAttachments.length > 0
}

/**
 * Extract file IDs from a message
 * 
 * @param message - The message to extract from
 * @returns Array of file IDs
 */
export function getFileIdsFromMessage(message: any): string[] {
  if (!hasFileAttachments(message)) {
    return []
  }
  
  return message.fileAttachments.map((file: any) => file.id).filter(Boolean)
}