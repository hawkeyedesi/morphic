import { v4 as uuidv4 } from 'uuid';
import { getRedisClient } from '../redis/config';
import { FileAttachment } from '../types/file';

// Create Redis client promise
const redisPromise = getRedisClient();

// Max size for Redis storage (1MB as a reasonable limit)
const MAX_REDIS_TEXT_SIZE = 1024 * 1024;

/**
 * Update file metadata in Redis with better error handling
 * 
 * @param fileAttachment - The file attachment to update
 * @returns Boolean indicating success
 */
export async function updateFileMetadataEnhanced(fileAttachment: FileAttachment): Promise<boolean> {
  try {
    const redis = await redisPromise;
    
    // Create a copy of the file attachment for safe modification
    const fileMeta = { ...fileAttachment };
    
    // Check if extracted text is too large for Redis
    if (fileMeta.extractedText && fileMeta.extractedText.length > MAX_REDIS_TEXT_SIZE) {
      console.log(`[DEBUG] Extracted text too large for Redis (${fileMeta.extractedText.length} bytes). Truncating...`);
      
      // Store a truncated version with a note
      const truncatedText = fileMeta.extractedText.substring(0, MAX_REDIS_TEXT_SIZE - 200);
      fileMeta.extractedText = `${truncatedText}\n\n[TEXT TRUNCATED: Original size ${fileMeta.extractedText.length} bytes]`;
      
      // Set a flag to indicate truncation
      (fileMeta as any).textTruncated = true;
    }
    
    // Create a Redis-friendly object with string values
    const redisMetadata: Record<string, string> = {};
    
    // Convert all values to strings for Redis
    Object.entries(fileMeta).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      
      if (value instanceof Date) {
        redisMetadata[key] = value.toISOString();
      } else if (typeof value === 'object') {
        redisMetadata[key] = JSON.stringify(value);
      } else {
        redisMetadata[key] = String(value);
      }
    });
    
    // Store the file metadata in Redis
    await redis.hmset(`file:${fileMeta.id}`, redisMetadata);
    
    return true;
  } catch (error) {
    console.error('Error updating file metadata in Redis:', error);
    return false;
  }
}

/**
 * Add a file to a chat with retry mechanism
 * 
 * @param chatId - The chat ID
 * @param fileId - The file ID
 * @returns Boolean indicating success
 */
export async function addFileToChatEnhanced(chatId: string, fileId: string): Promise<boolean> {
  try {
    const redis = await redisPromise;
    
    // Try to add the file to the chat set with retries
    const maxRetries = 3;
    let retries = 0;
    let success = false;
    
    while (retries < maxRetries && !success) {
      try {
        await redis.sadd(`chat:${chatId}:files`, fileId);
        
        // Also update a flag to indicate files are attached
        // Using hmset since set isn't available in RedisWrapper
        await redis.hmset(`chat:${chatId}:meta`, {
          has_files: '1',
          updated_at: new Date().toISOString()
        });
        
        success = true;
      } catch (retryError) {
        retries++;
        console.error(`Error adding file to chat (attempt ${retries}):`, retryError);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }
    
    return success;
  } catch (error) {
    console.error('Error adding file to chat:', error);
    return false;
  }
}

/**
 * Generate a chat folder for file attachments
 * 
 * @param chatId - The chat ID
 * @returns The folder path
 */
export function generateChatFolderEnhanced(chatId: string): string {
  // Create a folder structure to avoid too many files in one directory
  const prefix = chatId.substring(0, 2);
  return `uploads/${prefix}/${chatId}`;
}

/**
 * Generate a unique file ID with better collision avoidance
 * 
 * @returns A unique file ID
 */
export function generateUniqueFileIdEnhanced(): string {
  // Generate a UUID v4
  const uuid = uuidv4();
  
  // Add a timestamp prefix for better sorting and uniqueness
  const timestamp = Date.now().toString(36);
  
  return `${timestamp}-${uuid}`;
}