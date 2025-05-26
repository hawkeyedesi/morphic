import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getDocumentService } from '@/lib/services/simple-document-service'
import { getAdvancedDocumentService } from '@/lib/services/advanced-document-service'
import { ProcessingConfig } from '@/lib/types/processing-config'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const formData = await request.formData()
    const file = formData.get('file') as File
    const chatId = formData.get('chatId') as string
    const processingMode = formData.get('processingMode') as string
    const chunkingStrategy = formData.get('chunkingStrategy') as string
    
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
    
    console.log('📤 Document upload request:', {
      processingMode,
      chunkingStrategy,
      fileType: file.name.split('.').pop()?.toLowerCase(),
      fileSize: file.size
    })
    
    // Check if we should use advanced service
    const useAdvanced = processingMode === 'advanced' || chunkingStrategy
    const useCloud = processingMode === 'cloud'
    
    if (useAdvanced || useCloud) {
      console.log('🚀 Using advanced document service')
      // Build processing config
      const config: ProcessingConfig = {
        mode: useCloud ? 'cloud' : 'local',
        chunkingStrategy: chunkingStrategy as any || 'auto'
      }
      
      // Set up cloud configuration if needed
      if (config.mode === 'cloud') {
        config.provider = 'openrouter'
        config.apiKey = process.env.OPENROUTER_API_KEY
        console.log('☁️  Cloud processing enabled with strategy:', config.chunkingStrategy)
      } else {
        console.log('🏠 Local processing with strategy:', config.chunkingStrategy)
      }
      
      const advancedService = await getAdvancedDocumentService(config)
      const document = await advancedService.uploadDocument(file, userId, chatId)
      
      console.log('📄 Document upload result:', document)
      return NextResponse.json({ document })
    } else {
      console.log('📦 Using simple document service')
      // Simple service always uses local embeddings
      const documentService = await getDocumentService()
      const document = await documentService.uploadDocument(file, userId, chatId)
      
      return NextResponse.json({ document })
    }
  } catch (error) {
    console.error('Document upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to upload document: ${errorMessage}` },
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
    
    // Try to get documents from both services and merge them
    let allDocuments: any[] = []
    
    try {
      // Get simple service documents
      const documentService = await getDocumentService()
      const simpleDocuments = await documentService.getDocuments(userId, chatId)
      console.log('📦 Simple service documents:', simpleDocuments.length)
      allDocuments.push(...simpleDocuments)
    } catch (error) {
      console.log('📦 No simple service documents found or error:', error)
    }
    
    try {
      // Get advanced service documents (both local and cloud)
      const localConfig: ProcessingConfig = { mode: 'local', chunkingStrategy: 'auto' }
      const cloudConfig: ProcessingConfig = { mode: 'cloud', chunkingStrategy: 'auto' }
      
      // Try local advanced documents
      const localAdvancedService = await getAdvancedDocumentService(localConfig)
      const localAdvancedDocuments = await localAdvancedService.getDocuments(userId, chatId)
      console.log('🏠 Local advanced service documents:', localAdvancedDocuments.length)
      allDocuments.push(...localAdvancedDocuments)
      
      // Try cloud advanced documents
      const cloudAdvancedService = await getAdvancedDocumentService(cloudConfig)
      const cloudAdvancedDocuments = await cloudAdvancedService.getDocuments(userId, chatId)
      console.log('☁️  Cloud advanced service documents:', cloudAdvancedDocuments.length)
      allDocuments.push(...cloudAdvancedDocuments)
      
    } catch (error) {
      console.log('🚀 No advanced service documents found or error:', error)
    }
    
    // Remove duplicates based on id
    const uniqueDocuments = allDocuments.filter((doc, index, self) => 
      index === self.findIndex(d => d.id === doc.id)
    )
    
    console.log(`📄 Total unique documents found: ${uniqueDocuments.length}`)
    
    return NextResponse.json({ documents: uniqueDocuments })
  } catch (error) {
    console.error('Get documents error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve documents' },
      { status: 500 }
    )
  }
}