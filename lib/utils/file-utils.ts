import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { FileAttachment } from '../types/file'

// Base directory for file uploads
const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

/**
 * Ensures the upload directory structure exists
 * 
 * @param userId - User ID
 * @param chatId - Chat ID
 * @returns The full path to the directory
 */
export async function ensureUploadDirectory(userId: string, chatId: string): Promise<string> {
  const dirPath = path.join(UPLOADS_DIR, userId, chatId)
  
  // Create directory recursively if it doesn't exist
  await fs.promises.mkdir(dirPath, { recursive: true })
  
  return dirPath
}

/**
 * Store a file in the filesystem
 * 
 * @param file - The file to store
 * @param userId - User ID
 * @param chatId - Chat ID
 * @returns File attachment metadata
 */
export async function storeFile(
  file: File,
  userId: string,
  chatId: string
): Promise<FileAttachment> {
  // Generate a unique ID for the file
  const fileId = uuidv4()
  
  // Ensure the upload directory exists
  const uploadDir = await ensureUploadDirectory(userId, chatId)
  
  // Get file extension
  const fileExt = path.extname(file.name)
  
  // Create a safe filename with the UUID and original extension
  const fileName = `${fileId}${fileExt}`
  const filePath = path.join(uploadDir, fileName)
  
  // Convert the File object to a Buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  
  // Write the file to disk
  await fs.promises.writeFile(filePath, buffer)
  
  // Create and return file metadata
  const fileAttachment: FileAttachment = {
    id: fileId,
    originalName: file.name,
    storagePath: path.join(userId, chatId, fileName), // Store relative path
    mimeType: file.type,
    size: file.size,
    uploadedAt: new Date(),
    processingStatus: 'pending'
  }
  
  return fileAttachment
}

/**
 * Get the absolute path to a stored file
 * 
 * @param storagePath - Relative storage path
 * @returns Absolute file path
 */
export function getAbsoluteFilePath(storagePath: string): string {
  return path.join(UPLOADS_DIR, storagePath)
}

/**
 * Read a stored file
 * 
 * @param fileAttachment - File attachment metadata
 * @returns File buffer
 */
export async function readFile(fileAttachment: FileAttachment): Promise<Buffer> {
  const filePath = getAbsoluteFilePath(fileAttachment.storagePath)
  return fs.promises.readFile(filePath)
}

/**
 * Delete a stored file
 * 
 * @param fileAttachment - File attachment metadata
 */
export async function deleteFile(fileAttachment: FileAttachment): Promise<void> {
  const filePath = getAbsoluteFilePath(fileAttachment.storagePath)
  
  try {
    await fs.promises.unlink(filePath)
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error)
    throw error
  }
}

/**
 * Clean up orphaned files that are no longer referenced
 * 
 * @param userId - User ID
 * @param chatId - Chat ID
 * @param validFileIds - Array of valid file IDs to keep
 */
export async function cleanupOrphanedFiles(
  userId: string,
  chatId: string,
  validFileIds: string[]
): Promise<void> {
  const dirPath = path.join(UPLOADS_DIR, userId, chatId)
  
  try {
    // Get all files in the directory
    const files = await fs.promises.readdir(dirPath)
    
    // Delete any file not in the valid file IDs list
    for (const file of files) {
      const fileId = path.parse(file).name
      
      if (!validFileIds.includes(fileId)) {
        await fs.promises.unlink(path.join(dirPath, file))
      }
    }
  } catch (error) {
    // Directory might not exist, which is fine
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`Error cleaning up orphaned files:`, error)
      throw error
    }
  }
}

/**
 * Validate a file based on size and type
 * 
 * @param file - The file to validate
 * @param maxSize - Maximum file size in bytes (default: 10MB)
 * @param allowedTypes - Array of allowed MIME types (default: common document types)
 * @returns Object with validation result and error message if any
 */
export function validateFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024, // 10MB default
  allowedTypes: string[] = [
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
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  ]
): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds the maximum allowed size of ${Math.round(maxSize / (1024 * 1024))}MB`
    }
  }
  
  // Check file type if allowed types are specified
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not supported'
    }
  }
  
  return { valid: true }
}