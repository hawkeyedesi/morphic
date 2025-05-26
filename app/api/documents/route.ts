import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getDocumentService } from '@/lib/services/simple-document-service'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const formData = await request.formData()
    const file = formData.get('file') as File
    const chatId = formData.get('chatId') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }
    
    if (!chatId) {
      return NextResponse.json(
        { error: 'No chatId provided' },
        { status: 400 }
      )
    }
    
    // Validate file type
    const allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'md', 'png', 'jpg', 'jpeg']
    const fileType = file.name.split('.').pop()?.toLowerCase()
    
    if (!fileType || !allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, DOC, DOCX, TXT, MD, PNG, JPG, JPEG' },
        { status: 400 }
      )
    }
    
    // Upload and process document
    const documentService = await getDocumentService()
    const document = await documentService.uploadDocument(file, userId, chatId)
    
    return NextResponse.json({ document })
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
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
    
    const documentService = await getDocumentService()
    const documents = await documentService.getDocuments(userId, chatId)
    
    return NextResponse.json({ documents })
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve documents' },
      { status: 500 }
    )
  }
}