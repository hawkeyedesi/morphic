import { tool } from 'ai'
import { z } from 'zod'
import { getDocumentService } from '@/lib/services/simple-document-service'
import { getAdvancedDocumentService } from '@/lib/services/advanced-document-service'

export const documentSearchTool = (chatId: string) => tool({
  description: 'Search through uploaded documents for relevant information',
  parameters: z.object({
    query: z.string().describe('The search query to find relevant document content'),
    limit: z.number().optional().default(5).describe('Maximum number of results to return')
  }),
  execute: async ({ query, limit }) => {
    try {
      // Check if we're in a browser environment and get processing mode
      let service: any
      if (typeof window !== 'undefined') {
        const processingMode = localStorage.getItem(`processing-mode-${chatId}`)
        if (processingMode === 'cloud') {
          const config = {
            mode: 'cloud' as const,
            provider: 'openrouter' as const,
            apiKey: process.env.OPENROUTER_API_KEY
          }
          service = await getAdvancedDocumentService(config)
        } else {
          service = await getDocumentService()
        }
      } else {
        // Server-side: default to simple service
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