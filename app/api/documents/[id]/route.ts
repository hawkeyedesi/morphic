import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'No chatId provided' },
        { status: 400 }
      )
    }
    
    const documentId = params.id
    console.log(`🗑️  Deleting document: ${documentId} from chat: ${chatId}`)
    
    // Build the base path
    const baseDir = path.join(process.cwd(), 'uploads', 'chats', chatId)
    
    try {
      // Check if directory exists
      await fs.access(baseDir)
      
      // Get all files in the directory
      const files = await fs.readdir(baseDir)
      
      // Find and delete all files related to this document
      const deletedFiles: string[] = []
      for (const file of files) {
        if (file.startsWith(documentId)) {
          const filePath = path.join(baseDir, file)
          await fs.unlink(filePath)
          deletedFiles.push(file)
        }
      }
      
      if (deletedFiles.length === 0) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
      
      console.log(`✅ Deleted files: ${deletedFiles.join(', ')}`)
      
      // Check if directory is empty and remove it
      const remainingFiles = await fs.readdir(baseDir)
      if (remainingFiles.length === 0) {
        await fs.rmdir(baseDir)
        console.log(`📁 Removed empty directory: ${baseDir}`)
      }
      
      return NextResponse.json({ 
        success: true, 
        deletedFiles 
      })
      
    } catch (error) {
      // Directory doesn't exist or file not found
      console.error('Delete error:', error)
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }
    
  } catch (error) {
    console.error('Document delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}