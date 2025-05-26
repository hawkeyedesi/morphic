import { tool } from 'ai'
import { z } from 'zod'
import { getDocumentService } from '@/lib/services/simple-document-service'

export const documentSearchTool = tool({
  name: 'searchDocuments',
  description: 'Search through uploaded documents for relevant information',
  parameters: z.object({
    query: z.string().describe('The search query to find relevant document content'),
    limit: z.number().optional().default(5).describe('Maximum number of results to return')
  }),
  execute: async ({ query, limit }) => {
    try {
      const documentService = await getDocumentService()
      const results = await documentService.searchDocuments(query, limit)
      
      if (results.length === 0) {
        return {
          success: true,
          results: [],
          message: 'No relevant documents found for your query.'
        }
      }
      
      const formattedResults = results.map(r => ({
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