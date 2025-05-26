import { tool } from 'ai'
import { z } from 'zod'
import { getDocumentService } from '@/lib/services/simple-document-service'
import { getAdvancedDocumentService } from '@/lib/services/advanced-document-service'

export const documentSearchTool = (chatId: string, processingMode?: 'local' | 'cloud') => tool({
  description: 'Search through uploaded documents for relevant information',
  parameters: z.object({
    query: z.string().describe('The search query to find relevant document content'),
    limit: z.number().optional().default(5).describe('Maximum number of results to return')
  }),
  execute: async ({ query, limit }) => {
    try {
      console.log('🔍 Document search:', { query, chatId, processingMode })
      
      // Use the provided processing mode or check for advanced documents
      let service: any
      
      // Check if there are any advanced documents (with metadata files)
      const fs = require('fs').promises
      const path = require('path')
      const storagePath = path.join(process.cwd(), 'uploads', 'chats', chatId)
      
      try {
        const files = await fs.readdir(storagePath)
        const hasAdvancedDocs = files.some((f: string) => f.endsWith('_metadata.json'))
        
        if (hasAdvancedDocs || processingMode === 'cloud') {
          console.log('🚀 Using advanced document service for search')
          const config = {
            mode: 'cloud' as const,
            provider: 'openrouter' as const,
            apiKey: process.env.OPENROUTER_API_KEY
          }
          service = await getAdvancedDocumentService(config)
        } else {
          console.log('📦 Using simple document service for search')
          service = await getDocumentService()
        }
      } catch (error) {
        // No documents directory, use simple service
        console.log('📦 No documents found, using simple service')
        service = await getDocumentService()
      }
      
      const results = await service.searchDocuments(query, chatId, limit)
      
      if (results.length === 0) {
        return {
          success: true,
          results: [],
          message: 'No relevant documents found for your query.'
        }
      }
      
      const formattedResults = results.map((r: any) => ({
        documentName: r.document_name,
        content: r.content,
        pageNumber: r.metadata.page_number,
        relevanceScore: r.similarity
      }))
      
      console.log('Document search results:', formattedResults)
      
      return {
        success: true,
        results: formattedResults,
        message: `Found ${results.length} relevant document sections.`
      }
    } catch (error) {
      console.error('Document search error:', error)
      return {
        success: false,
        results: [],
        message: 'Failed to search documents. Please try again.'
      }
    }
  }
})